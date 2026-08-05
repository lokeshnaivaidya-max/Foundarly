-- =====================================================
-- SEED DATA FOR CONSULTANTS AND NETWORKING CHANNELS
-- =====================================================
-- This script clears existing data and inserts fresh seed data
-- Run this in your Supabase SQL Editor

-- =====================================================
-- CLEAR EXISTING DATA
-- =====================================================

-- Clear networking related data first (due to foreign keys)
DELETE FROM channel_members;
DELETE FROM channel_messages;
DELETE FROM startup_showcases;
DELETE FROM message_reactions;
DELETE FROM reports;
DELETE FROM group_posts;
DELETE FROM group_members;
DELETE FROM user_groups;
DELETE FROM channels;

-- Clear consultants data
DELETE FROM consultants;

-- =====================================================
-- INSERT CONSULTANTS
-- =====================================================

INSERT INTO consultants (name, title, bio, expertise, pricing_30, pricing_60, image_url, is_active, created_at)
VALUES
  (
    'Rajesh',
    'Chartered Accountant',
    'Experienced Chartered Accountant specializing in taxation, auditing, and comprehensive financial planning for businesses of all sizes.',
    ARRAY['Taxation', 'Auditing', 'Financial Planning', 'GST Compliance', 'Business Advisory'],
    1500,
    2500,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Rajesh',
    true,
    NOW()
  ),
  (
    'Ranjan Verma',
    'Jewellery Business Consultant',
    'Expert consultant in jewellery business operations, retail strategies, and market positioning with over 15 years of industry experience.',
    ARRAY['Jewellery Business', 'Retail Strategy', 'Market Analysis', 'Precious Metals Trading', 'Brand Development'],
    1350,
    2250,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=RanjanVerma',
    true,
    NOW()
  ),
  (
    'Puneet Sharma',
    'Petrol Pump Business Consultant',
    'Specialized consultant for petrol pump businesses, covering operations, compliance, and profitability optimization.',
    ARRAY['Fuel Retail', 'Operations Management', 'Compliance', 'Profitability Analysis', 'Safety Standards'],
    1125,
    1875,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=PuneetSharma',
    true,
    NOW()
  ),
  (
    'Sai Prasad Tiwari',
    'Real Estate Business Consultant',
    'Real estate expert providing guidance on property development, investment strategies, and market analysis.',
    ARRAY['Real Estate', 'Property Development', 'Investment Strategy', 'Market Analysis', 'Legal Compliance'],
    1650,
    2750,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=SaiPrasadTiwari',
    true,
    NOW()
  ),
  (
    'Akshat Birla',
    'Spices & Dry Fruits Business Consultant',
    'Consultant specializing in spices and dry fruits business, including sourcing, quality control, and distribution strategies.',
    ARRAY['Spices Trade', 'Dry Fruits Business', 'Supply Chain', 'Quality Control', 'Export-Import'],
    1200,
    2000,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=AkshatBirla',
    true,
    NOW()
  ),
  (
    'Sumeet Jain',
    'Cosmetic Business Consultant',
    'Expert in cosmetic business operations, brand development, and retail strategies for beauty products.',
    ARRAY['Cosmetics Industry', 'Brand Development', 'Retail Strategy', 'Product Formulation', 'Marketing'],
    1275,
    2125,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=SumeetJain',
    true,
    NOW()
  ),
  (
    'Hrishikesh Mishra',
    'IT Support Consultant',
    'IT consultant providing comprehensive technical support, infrastructure planning, and digital transformation guidance.',
    ARRAY['IT Infrastructure', 'Technical Support', 'Digital Transformation', 'Cloud Solutions', 'Cybersecurity'],
    1425,
    2375,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=HrishikeshMishra',
    true,
    NOW()
  );

-- =====================================================
-- INSERT NETWORKING CHANNELS
-- =====================================================

INSERT INTO channels (name, description, category, icon, is_public, member_count, created_at, updated_at)
VALUES
  (
    'Industrial Raw Materials',
    'Connect with suppliers and buyers of plastic, steel, chemicals, rubber, metals, and other industrial raw materials.',
    'Industry',
    '🏭',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Manufacturing & Production',
    'Network for manufacturers, production managers, and industry professionals to share insights and opportunities.',
    'Industry',
    '⚙️',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Construction & Infrastructure',
    'Discussion hub for construction professionals, contractors, and infrastructure development experts.',
    'Industry',
    '🏗️',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Real Estate & Property',
    'Connect with real estate professionals, property developers, and investment experts.',
    'Industry',
    '🏢',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Agriculture & Agri-Trade (Veg-Based)',
    'Platform for agricultural professionals, farmers, and vegetable-based agri-trade businesses.',
    'Industry',
    '🌾',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Organic & Herbal Industry',
    'Network for organic products, herbal medicines, and natural wellness industry professionals.',
    'Industry',
    '🌿',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'FMCG & Consumer Goods',
    'Connect with FMCG professionals, distributors, and consumer goods manufacturers.',
    'Industry',
    '🛒',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Beauty, Skincare & Personal Care',
    'Hub for beauty industry professionals, skincare experts, and personal care product businesses.',
    'Industry',
    '💄',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Textile & Apparel',
    'Network for textile manufacturers, apparel designers, and fashion industry professionals.',
    'Industry',
    '👔',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Jewellery & Precious Metals',
    'Connect with jewellery designers, precious metal traders, and industry experts.',
    'Industry',
    '💎',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Packaging & Printing',
    'Platform for packaging solutions, printing services, and related industry professionals.',
    'Industry',
    '📦',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Automobile & Auto Components',
    'Network for automobile industry professionals, auto component manufacturers, and dealers.',
    'Industry',
    '🚗',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Machinery & Industrial Equipment',
    'Connect with machinery suppliers, industrial equipment manufacturers, and maintenance experts.',
    'Industry',
    '🔧',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Electronics & Electricals',
    'Hub for electronics manufacturers, electrical equipment suppliers, and technology professionals.',
    'Technology',
    '⚡',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Renewable Energy & Sustainability',
    'Network for renewable energy professionals, sustainability experts, and green technology advocates.',
    'Technology',
    '♻️',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Waste Management & Recycling',
    'Platform for waste management professionals, recycling businesses, and environmental experts.',
    'Industry',
    '🗑️',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Import–Export & Global Trade',
    'Connect with import-export professionals, international traders, and global business experts.',
    'Business',
    '🌍',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Logistics & Supply Chain',
    'Network for logistics professionals, supply chain managers, and transportation experts.',
    'Business',
    '🚚',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Wholesale & Distribution',
    'Hub for wholesalers, distributors, and bulk trading professionals.',
    'Business',
    '📊',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Retail & E-commerce',
    'Connect with retail professionals, e-commerce entrepreneurs, and online business experts.',
    'Business',
    '🛍️',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Technology & Software',
    'Platform for tech professionals, software developers, and IT industry experts.',
    'Technology',
    '💻',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Digital Marketing & Media',
    'Network for digital marketers, media professionals, and content creators.',
    'Marketing',
    '📱',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Finance, Investment & Banking',
    'Connect with finance professionals, investment advisors, and banking experts.',
    'Finance',
    '💰',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Professional Services',
    'Hub for CA, legal, consulting, HR, compliance, and other professional service providers.',
    'Business',
    '💼',
    true,
    0,
    NOW(),
    NOW()
  ),
  (
    'Education, Training & Skill Development',
    'Platform for educators, trainers, and skill development professionals.',
    'Education',
    '📚',
    true,
    0,
    NOW(),
    NOW()
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check inserted consultants
SELECT COUNT(*) as total_consultants FROM consultants;

-- Check inserted channels
SELECT COUNT(*) as total_channels FROM channels;

-- List all consultants
SELECT id, name, title FROM consultants ORDER BY name;

-- List all channels
SELECT id, name, category FROM channels ORDER BY name;
