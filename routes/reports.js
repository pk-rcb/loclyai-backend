import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// ─── MULTER SETUP ────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'report-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Helper: Reverse Geocode via Nominatim
async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      headers: {
        'User-Agent': 'LoclyAI-App/1.0 (admin@locly.ai)'
      }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Reverse Geocode error:', err);
    return null;
  }
}

// ─── CREATE REPORT (Citizen only) ────────────────────────
router.post('/', authenticateToken, requireRole('citizen'), upload.single('image'), async (req, res) => {
  try {
    const { description, latitude, longitude } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required.' });
    }
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'GPS coordinates are required.' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    // Reverse Geocoding — get full data
    const geoData = await reverseGeocode(latitude, longitude);
    
    let state = 'Unknown State';
    let district = 'Unknown District';
    let municipality = 'Unknown Municipality';
    let ward = 'Unknown Ward';
    let addressDisplay = '';
    let pincode = '';

    if (geoData && geoData.address) {
      const addr = geoData.address;
      state = addr.state || addr.region || state;
      district = addr.state_district || addr.county || district;
      municipality = addr.city || addr.town || addr.municipality || addr.village || municipality;
      ward = addr.suburb || addr.neighbourhood || addr.hamlet || ward;
      pincode = addr.postcode || '';
      
      // Build human-readable address
      addressDisplay = geoData.display_name || `${ward}, ${municipality}, ${district}, ${state}`;
    }

    // Try to find an authority matching this pincode
    let assignedAuthorityId = null;
    if (pincode) {
      const authorityResult = await pool.query(
        'SELECT id FROM authorities WHERE pincode = $1 AND is_approved = true LIMIT 1',
        [pincode]
      );
      if (authorityResult.rows.length > 0) {
        assignedAuthorityId = authorityResult.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO reports (citizen_id, description, image_url, latitude, longitude, state, district, municipality, ward, address_display, assigned_authority_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Pending')
       RETURNING *`,
      [req.user.id, description, imageUrl, latitude, longitude, state, district, municipality, ward, addressDisplay, assignedAuthorityId]
    );

    res.status(201).json({
      message: 'Report submitted successfully!',
      report: result.rows[0]
    });
  } catch (err) {
    console.error('Create report error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── GET CITIZEN'S OWN REPORTS (with status tracking) ────
router.get('/my-reports', authenticateToken, requireRole('citizen'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, a.full_name as authority_name 
       FROM reports r 
       LEFT JOIN authorities a ON r.assigned_authority_id = a.id
       WHERE r.citizen_id = $1 AND r.status != 'Withdrawn'
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json({ reports: result.rows });
  } catch (err) {
    console.error('Fetch reports error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── GET SINGLE REPORT DETAILS (Citizen) ─────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT r.*, a.full_name as authority_name, a.municipality as authority_municipality
       FROM reports r 
       LEFT JOIN authorities a ON r.assigned_authority_id = a.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const report = result.rows[0];

    // Citizens can only view their own reports
    if (req.user.type === 'citizen' && report.citizen_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json({ report });
  } catch (err) {
    console.error('Fetch report error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── GET REPORTS FOR AUTHORITY (pincode-matched) ─────────
router.get('/authority/my-area', authenticateToken, requireRole('authority'), async (req, res) => {
  try {
    // Get authority's pincode
    const authResult = await pool.query(
      'SELECT pincode, municipality, district, state FROM authorities WHERE id = $1',
      [req.user.id]
    );

    if (authResult.rows.length === 0) {
      return res.status(404).json({ error: 'Authority profile not found.' });
    }

    const authority = authResult.rows[0];

    // Fetch reports that match authority's pincode OR are assigned to this authority
    const result = await pool.query(
      `SELECT r.*, c.full_name as citizen_name, c.phone as citizen_phone
       FROM reports r
       LEFT JOIN citizens c ON r.citizen_id = c.id
       WHERE (r.assigned_authority_id = $1 
              OR (r.municipality ILIKE $2 AND r.assigned_authority_id IS NULL))
       ORDER BY 
         CASE r.status 
           WHEN 'Pending' THEN 1 
           WHEN 'Approved' THEN 2 
           WHEN 'Completed' THEN 3 
           WHEN 'Rejected' THEN 4 
         END,
         r.created_at DESC`,
      [req.user.id, `%${authority.municipality}%`]
    );

    res.json({ reports: result.rows, authority });
  } catch (err) {
    console.error('Fetch authority reports error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── APPROVE REPORT (Authority) ──────────────────────────
router.patch('/:id/approve', authenticateToken, requireRole('authority'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};

    const result = await pool.query(
      `UPDATE reports 
       SET status = 'Approved', assigned_authority_id = $1, authority_notes = $2
       WHERE id = $3 AND status = 'Pending'
       RETURNING *`,
      [req.user.id, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or already processed.' });
    }

    res.json({ message: 'Report approved.', report: result.rows[0] });
  } catch (err) {
    console.error('Approve report error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── REJECT REPORT (Authority) ───────────────────────────
router.patch('/:id/reject', authenticateToken, requireRole('authority'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};

    const result = await pool.query(
      `UPDATE reports 
       SET status = 'Rejected', assigned_authority_id = $1, authority_notes = $2
       WHERE id = $3 AND status = 'Pending'
       RETURNING *`,
      [req.user.id, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or already processed.' });
    }

    res.json({ message: 'Report rejected.', report: result.rows[0] });
  } catch (err) {
    console.error('Reject report error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── MARK REPORT COMPLETED (Authority) ───────────────────
router.patch('/:id/complete', authenticateToken, requireRole('authority'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};

    const result = await pool.query(
      `UPDATE reports 
       SET status = 'Completed', authority_notes = COALESCE($1, authority_notes), resolved_at = NOW()
       WHERE id = $2 AND status = 'Approved' AND assigned_authority_id = $3
       RETURNING *`,
      [notes || null, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or not in Approved state.' });
    }

    res.json({ message: 'Report marked as completed.', report: result.rows[0] });
  } catch (err) {
    console.error('Complete report error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── WITHDRAW REPORT (Citizen, only if Pending) ──────────
router.delete('/:id/withdraw', authenticateToken, requireRole('citizen'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE reports 
       SET status = 'Withdrawn'
       WHERE id = $1 AND citizen_id = $2 AND status = 'Pending'
       RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or cannot be withdrawn (already processed).' });
    }

    res.json({ message: 'Report withdrawn successfully.' });
  } catch (err) {
    console.error('Withdraw report error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
