import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import { Pool } from 'pg';
import 'dotenv/config';  
import { heartlandFetch, createPurchaseOrder , addLineToPurchaseOrder} from './heartlandClient.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// helper to safely parse numeric fields
function parseNumber(val: string | undefined): number {
  if (!val) return 0;
  const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

async function ensureTablesExist() {
  try {
    // Heartland PO imports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS heartland_po_imports (
        id SERIAL PRIMARY KEY,
        po_number TEXT,
        po_description TEXT,
        po_start_ship DATE,
        po_end_ship DATE,
        po_vendor TEXT,
        po_received_at_location TEXT,
        item_description TEXT,
        item_default_cost NUMERIC,
        item_current_price NUMERIC,
        item_active BOOLEAN,
        item_track_inventory BOOLEAN,
        item_primary_vendor TEXT,
        item_taxable BOOLEAN,
        item_department TEXT,
        item_category TEXT,
        item_series TEXT,
        item_number TEXT,
        po_line_unit_cost NUMERIC,
        po_line_qty INTEGER,
        item_bricklink_id TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ToyHouse master data
    await pool.query(`
      CREATE TABLE IF NOT EXISTS toyhouse_master_data (
        id SERIAL PRIMARY KEY,
        brand TEXT,
        item_number TEXT,
        description TEXT,
        bricklink_id TEXT,
        department TEXT,
        sub_department TEXT,
        bam_category TEXT,
        theme TEXT,
        long_description TEXT,
        primary_vendor TEXT,
        sell_on_shopify BOOLEAN,
        shopify_tags TEXT,
        active BOOLEAN,
        msrp NUMERIC,
        default_cost NUMERIC,
        current_price NUMERIC,
        taxable BOOLEAN,
        upc TEXT,
        height NUMERIC,
        width NUMERIC,
        depth NUMERIC,
        weight NUMERIC,
        weight_in_oz NUMERIC,
        image_1 TEXT,
        image_2 TEXT,
        image_3 TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Sets images
    await pool.query(`
      CREATE TABLE IF NOT EXISTS set_image_urls (
        id SERIAL PRIMARY KEY,
        bricklink_id TEXT,
        rebrickable_image_url TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'heartland_import_status'
        ) THEN
          CREATE TYPE heartland_import_status AS ENUM (
            'loaded','reviewing','reviewed'
          );
        END IF;
      END
      $$;
    `);
    
    await pool.query(`
      -- master table for tracking each PO import
      CREATE TABLE IF NOT EXISTS heartland_import_master (
        po_number TEXT PRIMARY KEY,
        po_url TEXT,
        po_import_status heartland_import_status NOT NULL DEFAULT 'loaded'
      );
    `);


    console.log('✅ All tables ensured');
  } catch (err) {
    console.error('❌ Error ensuring tables:', err);
  }
}

ensureTablesExist();

// Serve React
app.use(express.static(path.resolve(__dirname, '../public')));

// 1️⃣ Heartland PO upload
app.post('/api/upload-po-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const filePath = req.file.path;
  const results: any[] = [];

  fs.createReadStream(filePath)
    .pipe(csv({
      mapHeaders: ({ header }) =>
        header.trim().toLowerCase().replace(/ /g, '_').replace(/#/g, 'number')
    }))
    .on('data', data => results.push(data))
    .on('end', async () => {
      try {
        const poNumber = results[0]?.po_number;
        if (poNumber) {
          // upsert into the master table, status=loaded
          await pool.query(`
            INSERT INTO heartland_import_master
              (po_number, po_url, po_import_status)
            VALUES ($1, $2, 'loaded')
            ON CONFLICT (po_number) DO UPDATE
              SET po_import_status = 'loaded'
          `, [poNumber, null]);
          }
        for (const row of results) {
          await pool.query(
            `INSERT INTO heartland_po_imports
              (po_number, po_description, po_start_ship, po_end_ship,
               po_vendor, po_received_at_location, item_description,
               item_default_cost, item_current_price, item_active,
               item_track_inventory, item_primary_vendor, item_taxable,
               item_department, item_category, item_series, item_number,
               po_line_unit_cost, po_line_qty, item_bricklink_id)
             VALUES
              ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
            [
              row.po_number,
              row.po_description,
              row.po_start_ship,
              row.po_end_ship,
              row.po_vendor,
              row.po_received_at_location,
              row.item_description,
              parseNumber(row.item_default_cost),
              parseNumber(row.item_current_price),
              row.item_active === 'yes',
              row.item_track_inventory === 'yes',
              row.item_primary_vendor,
              row.item_taxable === 'yes',
              row.item_department,
              row.item_category,
              row.item_series,
              row.item_number,
              parseNumber(row.po_line_unit_cost),
              parseInt(row.po_line_qty, 10) || 0,
              row.item_bricklink_id
            ]
          );
        }
        fs.unlinkSync(filePath);
        res.send('CSV data saved to database.');
      } catch (err) {
        console.error('❌ DB Insert Error:', err);
        res.status(500).send('Error saving CSV data to DB.');
      }
    });
});

app.get('/api/po-numbers', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT po_number FROM heartland_po_imports ORDER BY po_number'
    );
    // return array of strings
    res.json(result.rows.map((r) => r.po_number));
  } catch (err) {
    console.error('❌ Error fetching PO numbers:', err);
    res.status(500).send('Error fetching PO numbers');
  }
});

// 2️⃣ Fetch PO items
app.get('/api/import-items', async (req, res) => {
  const po = req.query.po as string | undefined;

  try {
    // Build base SQL
    let sql = `
      SELECT
        h.*,
        COALESCE(
          (SELECT rebrickable_image_url
           FROM set_image_urls
           WHERE bricklink_id = h.item_bricklink_id
           ORDER BY id DESC
           LIMIT 1),
          (SELECT image_1
           FROM toyhouse_master_data
           WHERE bricklink_id = h.item_bricklink_id
           ORDER BY id DESC
           LIMIT 1)
        ) AS image_url
      FROM heartland_po_imports h
    `;
    const params: any[] = [];

    // Optional PO filter
    if (po) {
      params.push(po);
      sql += ` WHERE h.po_number = $1`;
    }

    sql += ` ORDER BY h.id`;

    // Execute and return
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching items with images:', err);
    res.status(500).send('Error fetching import items');
  }
});



// 3️⃣ ToyHouse master CSV
app.post('/api/upload-toyhouse-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const filePath = req.file.path;
  const rows: any[] = [];

  fs.createReadStream(filePath)
    .pipe(csv({
      mapHeaders: ({ header }) =>
        header.trim().toLowerCase().replace(/ /g,'_').replace(/#/g,'number')
    }))
    .on('data', data => rows.push(data))
    .on('end', async () => {
      await pool.query('DELETE FROM toyhouse_master_data');
      let success = 0;
      for (const [i, row] of rows.entries()) {
        try {
          await pool.query(
            `INSERT INTO toyhouse_master_data
              (brand, item_number, description, bricklink_id,
               department, sub_department, bam_category, theme,
               long_description, primary_vendor, sell_on_shopify,
               shopify_tags, active, msrp, default_cost,
               current_price, taxable, upc, height, width,
               depth, weight, weight_in_oz, image_1, image_2, image_3)
             VALUES
              ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
               $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
               $21,$22,$23,$24,$25,$26)`,
            [
              row.brand,
              row.item_number,
              row.description,
              row.bricklink_id,
              row.department,
              row.sub_department,
              row.bam_category,
              row.theme,
              row.long_description,
              row.primary_vendor,
              row.sell_on_shopify === 'Yes',
              row.shopify_tags,
              row.active === 'TRUE',
              parseNumber(row.msrp),
              parseNumber(row.default_cost),
              parseNumber(row.current_price),
              row.taxable === 'Yes',
              row.upc,
              parseNumber(row.height),
              parseNumber(row.width),
              parseNumber(row.depth),
              parseNumber(row.weight),
              parseNumber(row.weight_in_oz),
              row.image_1,
              row.image_2,
              row.image_3
            ]
          );
          success++;
        } catch (e) {
          console.error(`⚠️ Skipped ToyHouse row ${i+1}:`, e);
        }
      }
      fs.unlinkSync(filePath);
      res.send(`Imported ${success} of ${rows.length} ToyHouse master records.`);
    });
});

// 4️⃣ Sets images CSV
app.post('/api/upload-sets-images', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const filePath = req.file.path;
  const rows: any[] = [];

  fs.createReadStream(filePath)
    .pipe(csv({ mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/ /g,'_') }))
    .on('data', data => rows.push(data))
    .on('end', async () => {
      await pool.query('DELETE FROM set_image_urls');
      let count = 0;
      for (const [i, row] of rows.entries()) {
        try {
          await pool.query(
            `INSERT INTO set_image_urls (bricklink_id, rebrickable_image_url)
             VALUES ($1,$2)`,
            [row.bricklink_id, row.rebrickable_image_url]
          );
          count++;
        } catch (e) {
          console.error(`⚠️ Skipped Sets row ${i+1}:`, e);
        }
      }
      fs.unlinkSync(filePath);
      res.send(`Imported ${count} of ${rows.length} set-image records.`);
    });
});

// GET /api/po-import-master
app.get('/api/po-import-master', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        po_number,
        po_url,
        po_import_status
      FROM heartland_import_master
      ORDER BY po_number
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching master records:', err);
    res.status(500).send('Error fetching PO import master records');
  }
});

app.post(
  '/api/po-import-master/:po/status',
  async (req, res) => {
    const po = req.params.po;
    const { status } = req.body as { status: string };
    if (!['loaded','reviewing','reviewed'].includes(status)) {
      return res.status(400).send('Invalid status');
    }
    try {
      await pool.query(
        `UPDATE heartland_import_master
         SET po_import_status = $1
         WHERE po_number = $2`,
        [status, po]
      );
      res.sendStatus(200);
    } catch (err) {
      console.error('❌ Error updating status:', err);
      res.status(500).send('Error updating status');
    }
  }
);

app.post('/api/create-po', async (req, res) => {
  const { vendorName } = req.body as { vendorName?: string };
  if (!vendorName) {
    return res.status(400).json({ error: 'vendorName is required' });
  }

  try {
    // 1) Search vendors by name
    // (Adjust query param if your API uses a different filter syntax)
    const vendorResp = await heartlandFetch(
      `/purchasing/vendors?search=${encodeURIComponent(vendorName)}`
    );
    const vendors = Array.isArray(vendorResp) ? vendorResp : vendorResp.data;
    if (!vendors.length) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    const vendorId = vendors[0].id;

    // 2) List locations and take the first one
    const locations = await heartlandFetch('/locations');
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(404).json({ error: 'No locations available' });
    }
    const locationId = locations[0].id;

    // 3) Create the purchase order
    const poId = await createPurchaseOrder({
      vendor_id: vendorId,
      receive_at_location_id: locationId,
      description: `PO for vendor ${vendorName}`
    });

    res.json({ purchaseOrderId: poId });
  } catch (err: any) {
    console.error('❌ Error creating PO:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/add-item-to-po
 * Body:
 *   {
 *     "itemId": number,
 *     "updateData": { /* fields to PATCH/PUT on the item *\/ },
 *     "purchaseOrderId": number,
 *     "qty": number,
 *     "unitCost": number,
 *     "qtyReceived": number? 
 *   }
 */
app.post('/api/add-item-to-po', async (req, res) => {
  const {
    itemId,
    updateData,
    purchaseOrderId,
    qty,
    unitCost,
    qtyReceived,
  } = req.body;

  if (
    typeof itemId !== 'number' ||
    typeof purchaseOrderId !== 'number' ||
    typeof qty !== 'number' ||
    typeof unitCost !== 'number'
  ) {
    return res.status(400).json({ error: 'itemId, purchaseOrderId, qty and unitCost are required and must be numbers' });
  }

  try {
    // 1) Update the item in Heartland
    await heartlandFetch(`/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData || {}),
    });

    // 2) Add a line to the purchase order
    const lineId = await addLineToPurchaseOrder(purchaseOrderId, {
      item_id: itemId,
      qty,
      unit_cost: unitCost,
      qty_received: typeof qtyReceived === 'number' ? qtyReceived : undefined,
    });

    return res.json({ lineId });
  } catch (err: any) {
    console.error('❌ /api/add-item-to-po error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});


// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
