-- Foundarly FAQs — run in Supabase SQL Editor

DELETE FROM faqs;

INSERT INTO faqs (question, answer, order_index) VALUES

('How can I become a consultant on Foundarly?', 'You can apply by submitting your professional details, experience, and portfolio for review. Click "Become a Consultant" in the navigation bar to get started.', 1),

('Are consultants employees of Foundarly?', 'No. Consultants are independent professionals who collaborate with Foundarly but are not employees of the platform.', 2),

('What happens after a consultation session?', 'Consultants are required to provide a PDF summary or report outlining the advice and recommendations given during the session.', 3),

('Can consultants connect with users outside the platform?', 'No. Consultants must not form personal business relationships or conduct off-platform transactions with users. All interactions must take place through Foundarly.', 4),

('How much commission does Foundarly take?', 'Foundarly charges a 30% platform commission on each completed consultation.', 5),

('How are consultants paid?', 'After the consultation is completed and payment is processed, the consultant receives their earnings minus the platform commission.', 6),

('What if a user leaves a complaint?', 'Foundarly reviews all complaints carefully. If necessary, appropriate action may be taken against the consultant after a thorough investigation.', 7),

('Are consultants required to maintain confidentiality?', 'Yes. Consultants must respect user privacy and keep all consultation information strictly confidential.', 8);
