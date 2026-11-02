/* =====================================================================
   Injanda Trading & Consult — default content (first run only)
   Everything below is taken from the company catalogue (2024).
   Prices, stock and photos are NOT invented: products without a price show
   "Request a quote" until you set a price in the admin panel.
   After the first visit the data lives in Supabase and is edited in Admin.
   ===================================================================== */

const CATEGORIES = [
  { id: 'all',           name: 'All products' },
  { id: 'kites',         name: 'Web Up Kites' },
  { id: 'washing',       name: 'Washing & Dampening' },
  { id: 'rollers',       name: 'Rollers & Rings' },
  { id: 'blades',        name: 'Blades & Cutting' },
  { id: 'folding',       name: 'Folding & Stitching' },
  { id: 'parts',         name: 'Plastic & Special Parts' },
  { id: 'electrical',    name: 'Electrical Repair' },
  { id: 'manufacturing', name: 'Manufacturing & Service' },
];

/* P(id, category, kind, name, image, description, specifications) */
const P = (id, cat, kind, name, img, desc, spec = {}) => ({ id, cat, kind, name, img, desc, spec, sku: id.toUpperCase(), price: 0, old: 0, stock: null, unit: '', hidden: false });

const SEED_PRODUCTS = [
  P('c01', 'kites', 'part', 'Heat-Resistant Web Up Kite', 'k1',
    'Heat-resistant web up kites for printing and packaging machines such as MAN, Goss, Wifag, KBA and W&H. Designed to your individual specification for transporting paper, carton and plastic foil.',
    { 'Guaranteed tensile load': '120 kg', Fits: 'MAN, Goss, Wifag, KBA, W&H', Lengths: 'Various lengths and shapes' }),
  P('c02', 'kites', 'part', 'Web Up Kite with Bowden Cable', 'k2',
    'Web up kites with or without Bowden cable, available in various lengths and shapes.',
    { 'Guaranteed tensile load': '120 kg', Option: 'With / without Bowden cable' }),
  P('c03', 'kites', 'part', 'Web Up Kite with Magnet', 'k3',
    'Magnetic web up kites for fast and secure web threading.',
    { 'Guaranteed tensile load': '120 kg', Option: 'Magnet fixing' }),
  P('c04', 'kites', 'part', 'Web Up Kite to Customer Sample', 'k4',
    'Web up kites made according to your sample, or modified to your requirements.',
    { 'Guaranteed tensile load': '120 kg', 'Made to': 'Customer sample / requirement' }),

  P('c05', 'washing', 'part', 'Brush Rollers for Blanket Washers', 'r1',
    'Suitable brush rollers for blanket washing equipment, with the original fill material and the right journal or closing rings, manufactured to OEM specification. Brushes for plate exposure machines (CTP) and special brushes are also available.',
    { Standard: 'OEM specification', Fill: 'Original fill material', Also: 'CTP and special brushes' }),
  P('c06', 'washing', 'part', 'Wash Cloths — Dry & Wet', 'set',
    'Dry and wet wash cloths in different qualities.', { Types: 'Dry and wet', Qualities: 'Several' }),
  P('c07', 'washing', 'part', 'Wear Components for Washing & Dampening Units', 'sp',
    'Cams, gears, slide bearings, blades, filters and seals are subject to permanent wear and must be replaced at intervals. The most common variants are in stock; special parts are made to manufacturer specification for full compatibility.',
    { Parts: 'Cams, gears, slide bearings, blades, filters, seals', Compatibility: 'Manufacturer specification' }),

  P('c08', 'rollers', 'part', 'Ductor, Film, Distribution, Chrome & Ink Rollers', 'r2',
    'We repair and manufacture rollers to all specifications with coatings such as ceramic, Rilsan®, chrome, rubber and other materials. Very good print results require high-precision rollers in concentricity and surface finish.',
    { 'Core materials': 'Steel, aluminium, CFRP, GRP', Coatings: 'Ceramic, Rilsan®, chrome, rubber' }),
  P('c09', 'rollers', 'part', 'Draw & Transport Rollers', 'r3',
    'Draw rollers made from optimised material combinations: very high dynamic load capacity, maximum operational smoothness and high wear resistance. Special designs on request.',
    { Core: 'Steel / aluminium', Coating: 'Rubber, polyurethane or Vulcollan®' }),
  P('c10', 'rollers', 'part', 'Drag, Transport & Cutting Rings, Tape Rollers', 'r4',
    'Repair and refurbishment of worn rings, and new production of tension elements in various surfaces and versions, from high-quality chromium-alloyed tool steels. CNC-machined, knurled or coated.',
    { Material: 'Chromium-alloyed tool steel', Versions: 'CNC-machined, knurled, coated' }),
  P('c11', 'rollers', 'part', 'Vulcollan® Guide Rails for Sheet Dampening', 'v1',
    'Guide rails for sheet dampening on all common web offset presses, made of homogeneous and cellular Vulcollan®, with very high dynamic load capacity, tensile strength, tear resistance and thermal stability.',
    { Versions: 'Homogeneous · combined with cellular · spring steel with cellular' }),
  P('c12', 'rollers', 'part', 'Bearer Ring Felts', 'set',
    'Special material for all common bearer ring felts for optimum function. Made to drawing or customer sample, on request with slots or holes.',
    { 'Made to': 'Drawing or customer sample', Options: 'Slots or holes on request' }),

  P('c13', 'blades', 'part', 'Folding Blades', 'bl1',
    'Folding blades in standard version, with simple or double chamfers, gaps and holes. Different coatings or special usage-based materials on request.',
    { Versions: 'Standard, single / double chamfer, gaps, holes', Coatings: 'On request' }),
  P('c14', 'blades', 'part', 'Cutter, Perforating & Rotary Blades, Book Spine Milling Cutters', 'bl2',
    'Cutting blades for sawing and perforating cuts. Tooth pitches and punch-outs to drawing or customer sample. Replacement blades for all common rotary cutters and book spine milling cutters.',
    { Brands: 'Gämmler, Rima, Müller Martini, Polar', Service: 'Incl. regrinding service' }),
  P('c15', 'blades', 'part', 'Circular & Perforating Circular Blades', 'bl3',
    'Circular blades in steel, HSS, special steel, carbide-coated steel or solid carbide. Chamfers, grooves, holes and tooth shapes to drawing or sample.',
    { 'Outer diameter': '20–350 mm', Material: 'Steel, HSS, special steel, carbide' }),
  P('c16', 'blades', 'service', 'Blade Grinding Service', 'bl2',
    'We resharpen and straighten your knives for long-term use.', { Service: 'Resharpening and straightening' }),

  P('c17', 'folding', 'part', 'Pins & Pin Holders for Folders', 'pin',
    'For almost all common folders the right pins and holders are available directly from our warehouse. Custom-made products on request to drawings or customer samples.',
    { Availability: 'From warehouse', Custom: 'To drawing or sample' }),
  P('c18', 'folding', 'part', 'Cutting Bars & Folding Jaws', 'b1',
    'An important wear part for the entire cutting system, in all standard sizes, qualities and any hardness from stock. Highly abrasion-resistant and tough with a long service life. Shortened and chamfered on request.',
    { Materials: 'Vulcollan® 92° Shore · Polyurethane 80/85/90/95° Shore' }),
  P('c19', 'folding', 'part', 'Folding & Counterfolding Plates', 'bl1',
    'Folding and counterfolding plates in tungsten carbide, ceramic or Vulcollan® coatings, with tight tolerances in thickness, height and parallelism. Worn folding flaps can be reconditioned after technical inspection.',
    { Coatings: 'Tungsten carbide, ceramics, Vulcollan®', Service: 'Repair and reconditioning' }),
  P('c20', 'folding', 'part', 'Stitcher & Stapling Parts', 'st',
    'Wear and spare parts for all common rotary and saddle stitchers, produced at our Frankenthal plant: plungers, wire bending and feeding rolls, wire rests (also with carbide), feeding jaws, cutting jets, clamping blocks, guides, stitch forks, side plates and leaf springs.',
    { Brands: 'KBA, Tolerans, MAN, Müller Martini', Designs: 'Various wire thicknesses and staple widths' }),

  P('c21', 'parts', 'part', 'Technical Plastic Mouldings', 'pl',
    'Mouldings made of thermoplastic material using cutting-edge production technology, in plastics such as Sgrün, PAG and POM.',
    { Materials: 'Sgrün, PAG, POM and others' }),
  P('c22', 'parts', 'part', 'Special Parts & Accessory Reworking', 'sp',
    'Individual parts as a matter of course: folding tables, barrels for reel splicers, gears, holders, former noses, eccentric bolts, curves and springs.',
    { Examples: 'Folding tables, gears, holders, former noses, eccentric bolts, springs' }),
  P('c23', 'parts', 'part', 'Sheetfed & Packaging Machine Parts', 'set',
    'Parts from metal, plastic and all common materials for sheetfed and packaging machines: sealing and washing squeegees, perforated belts, brushes, suction cups and more. Special designs to customer requirements.',
    { Materials: 'Metal, plastic, all common materials' }),

  P('c24', 'electrical', 'service', 'Servo Motor Repair', 'e1',
    'Systematic replacement of wearing parts on servo motors, exchange of bearings, inspection and reading of encoders, and thorough cleaning.',
    { Brands: 'ABB, Baumüller, Bosch Rexroth, Siemens, Lenze, Elau, B&R', Estimate: 'Free', Warranty: '6 months on the repair' }),
  P('c25', 'electrical', 'service', 'PLC, Industrial PC & Terminal Repair', 'e2',
    'Repair of programmed controls, terminals and industrial PCs. Free disposal in case of uneconomical repair.',
    { Brands: 'Siemens, Allen Bradley, B&R, Schneider and more', Estimate: 'Free', Warranty: '6 months on the repair' }),
  P('c26', 'electrical', 'service', 'Frequency Converter, Inverter & Drive Repair', 'e3',
    'Repair of frequency converters, inverters, cards and control units for printing machines.',
    { Brands: 'ABB, Baumüller, Bosch Rexroth, Lenze, Elau', Estimate: 'Free', Warranty: '6 months on the repair' }),
  P('c27', 'electrical', 'service', 'Electronic Board, Encoder & Tachometer Repair', 'e4',
    'Repair on component level with or without circuit diagrams, also for discontinued components. Replacement of defective components and inspection of solder joints.',
    { Level: 'Component level', Estimate: 'Free', Warranty: '6 months on the repair' }),

  P('c28', 'manufacturing', 'service', '5-Axis CNC Milling', 'c1',
    'Simple and complex milled parts for serial production and individual pieces. 5-axis simultaneous machining with CAD/CAM, quick-action clamping and modular tool changing, in a single setting.',
    { System: '5-axis simultaneous', Files: 'CAD files, or drawings' }),
  P('c29', 'manufacturing', 'service', 'Water Jet Cutting', 'c2',
    'We cut virtually any material up to 80 mm at approx. 3,800 bar, with a pure water jet or an abrasive-water jet, in 5 cutting qualities.',
    { Pressure: 'approx. 3,800 bar', Thickness: 'Up to 80 mm', Files: 'DXF, DWG' }),
  P('c30', 'manufacturing', 'service', '3D Metal Printing', 'c3',
    'A high-performance 1,000 watt laser system usable universally for different materials, combinable with conventional machining.',
    { Laser: '1,000 W', Combination: '3D printing + conventional machining' }),
  P('c31', 'manufacturing', 'service', 'Maintenance & Overhaul', 'st',
    'Repair, maintenance and overhaul worldwide: stitchers (KBA, MAN, Tolerans) at your site or at our Frankenthal premises, folders, printing units, blanket washing systems (OxyDry, Elletra, Baldwin, Rotoclean) and ink pumps (Betz, Lincoln).',
    { Assemblies: 'Stitchers, folders, printing units, washing systems, ink pumps' }),
];

const DEFAULT_BANNERS = [
  { id: 'b1', slot: 'main', tag: 'DIN ISO 9001 CERTIFIED', title: 'Precision spare parts for printing & packaging machines', sub: 'Made together with manufacturers in Germany — to your drawing or sample.', img: 'hero', bg: '#0f1b2d', cat: 'all' },
  { id: 'b2', slot: 'main', tag: 'WEB UP KITES', title: 'Guaranteed 120 kg tensile load', sub: 'With or without Bowden cable, heat-resistant or with magnet.', img: 'k4', bg: '#16283f', cat: 'kites' },
  { id: 'b3', slot: 'main', tag: 'ELECTRICAL REPAIR', title: 'Servo, drive & PLC repair', sub: 'Free estimate · 6 months warranty · free disposal if uneconomical.', img: 'e3', bg: '#1d2b33', cat: 'electrical' },
  { id: 's1', slot: 'side', tag: 'MANUFACTURING', title: '5-axis CNC machining', sub: 'From single parts to series', img: 'c1', bg: '#1f3a4d', cat: 'manufacturing' },
  { id: 's2', slot: 'side', tag: 'CUTTING', title: 'Folding, cutting & circular blades', sub: 'Incl. regrinding service', img: 'bl2', bg: '#33424a', cat: 'blades' },
  { id: 's3', slot: 'side', tag: 'WAREHOUSE', title: 'Thousands of parts in stock', sub: 'Automated high-rack storage', img: 'set', bg: '#3a2c24', cat: 'all' },
];

const DEFAULT_SETTINGS = {
  storeName: 'Injanda Trading',
  tagline: 'Spare parts & services for the printing and packaging industry',
  announce: 'Free estimate on repairs · 6-month warranty · Made to your drawing or sample',
  freeShip: 5000, shipFee: 150, lowStock: 10, logoSub: 'Trading & Consult', phone: '', email: '', address: '',
};
