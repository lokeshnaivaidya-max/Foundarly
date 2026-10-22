import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getSafeDatabaseErrorMessage } from '../src/utils/security.js';

describe('Foundarly Blog Creation, Storage Upload & Role-Based RLS Suite', () => {
  // Test Identities
  const superAdminUser = { id: 'super-admin-uid-1', email: 'admin@foundarly.com' };
  const superAdminProfile = { id: 'super-admin-uid-1', role: 'super_admin' as const, full_name: 'Super Admin User' };

  const devAdminUser = { id: 'dev-admin-uid-2', email: 'developer@foundarly.com' };
  const devAdminProfile = { id: 'dev-admin-uid-2', role: 'developer_admin' as const, full_name: 'Dev Admin' };

  const consultantUser = { id: 'consultant-uid-3', email: 'mentor@foundarly.com' };
  const consultantProfile = { id: 'consultant-uid-3', role: 'consultant' as const, full_name: 'Consultant User' };

  const clientUser = { id: 'client-uid-4', email: 'client@example.com' };
  const clientProfile = { id: 'client-uid-4', role: 'client' as const, full_name: 'Client User' };

  // Helper simulating public.is_admin() in PostgreSQL
  function simulateIsAdmin(user: any, profile: any): boolean {
    if (!user?.id || !profile) return false;
    return ['super_admin', 'developer_admin', 'admin'].includes(profile.role);
  }

  // Simulated Database State
  let blogDatabase: Array<{
    id: string;
    title: string;
    content: string;
    featured_image: string | null;
    meta_title: string | null;
    meta_description: string | null;
    status: 'published' | 'draft';
    created_at: string;
  }> = [];

  // Simulated Storage State for 'blog-images'
  let storageObjects: Array<{
    id: string;
    bucket_id: string;
    name: string;
    owner: string;
    created_at: string;
  }> = [];

  // RLS Evaluator for public.blog
  function evaluateBlogOperation(
    user: any,
    profile: any,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    record?: any
  ): boolean {
    const isAdmin = simulateIsAdmin(user, profile);

    switch (operation) {
      case 'SELECT':
        // Policy 1: Anyone can view published posts
        if (record?.status === 'published') return true;
        // Policy 2: Admins can view all posts (including drafts)
        return isAdmin;
      case 'INSERT':
        // Policy 3: Admins can insert blog posts
        return isAdmin;
      case 'UPDATE':
        // Policy 4: Admins can update blog posts
        return isAdmin;
      case 'DELETE':
        // Policy 5: Admins can delete blog posts
        return isAdmin;
      default:
        return false;
    }
  }

  // RLS Evaluator for storage.objects on bucket 'blog-images'
  function evaluateStorageOperation(
    user: any,
    profile: any,
    bucketId: string,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  ): boolean {
    if (bucketId !== 'blog-images') return false;
    const isAdmin = simulateIsAdmin(user, profile);

    switch (operation) {
      case 'SELECT':
        // Policy: Anyone can view public blog images
        return true;
      case 'INSERT':
      case 'UPDATE':
      case 'DELETE':
        // Policy: Only authenticated privileged admins can upload/modify/delete blog images
        return isAdmin;
      default:
        return false;
    }
  }

  // ==========================================================================
  // Test 1: Super Admin can create a text-only blog post (no image)
  // ==========================================================================
  test('1. Super Admin can create a text-only blog post (no image)', () => {
    const canInsert = evaluateBlogOperation(superAdminUser, superAdminProfile, 'INSERT');
    assert.equal(canInsert, true, 'Super Admin must be permitted to INSERT blog posts');

    const newPost = {
      id: 'post-1',
      title: 'Strategic Growth Insights for 2026',
      content: 'Detailed business expansion roadmap content without images...',
      featured_image: null,
      meta_title: 'Growth Insights 2026',
      meta_description: 'Strategic roadmap for modern founders',
      status: 'published' as const,
      created_at: new Date().toISOString(),
    };

    blogDatabase.push(newPost);
    assert.equal(blogDatabase.length, 1);
    assert.equal(blogDatabase[0].featured_image, null);
  });

  // ==========================================================================
  // Test 2: Developer Admin can create a text-only blog post (no image)
  // ==========================================================================
  test('2. Developer Admin can create a text-only blog post (no image)', () => {
    const canInsert = evaluateBlogOperation(devAdminUser, devAdminProfile, 'INSERT');
    assert.equal(canInsert, true, 'Developer Admin must be permitted to INSERT blog posts');

    const newPost = {
      id: 'post-2',
      title: 'Platform Architecture & Performance',
      content: 'Technical deep-dive into platform stability and query optimizations...',
      featured_image: null,
      meta_title: 'Platform Architecture',
      meta_description: 'Technical notes on architecture',
      status: 'draft' as const,
      created_at: new Date().toISOString(),
    };

    blogDatabase.push(newPost);
    assert.equal(blogDatabase.length, 2);
  });

  // ==========================================================================
  // Test 3: Super Admin can upload an image to blog-images and attach to blog post
  // ==========================================================================
  test('3. Super Admin can upload an image to blog-images and attach to blog post', () => {
    // Step 1: Storage Upload
    const canUpload = evaluateStorageOperation(superAdminUser, superAdminProfile, 'blog-images', 'INSERT');
    assert.equal(canUpload, true, 'Super Admin must be permitted to upload to blog-images');

    const imageObject = {
      id: 'obj-1',
      bucket_id: 'blog-images',
      name: 'blog-superadmin-hero.jpg',
      owner: superAdminUser.id,
      created_at: new Date().toISOString(),
    };
    storageObjects.push(imageObject);

    const publicUrl = `https://rfyxnshvtfswvaogjzwq.supabase.co/storage/v1/object/public/blog-images/${imageObject.name}`;

    // Step 2: Blog Insert with Image
    const canInsert = evaluateBlogOperation(superAdminUser, superAdminProfile, 'INSERT');
    assert.equal(canInsert, true);

    const postWithImage = {
      id: 'post-3',
      title: 'Founders Guide to Mentorship',
      content: 'Rich article content with hero graphic...',
      featured_image: publicUrl,
      meta_title: 'Founders Mentorship Guide',
      meta_description: 'How mentorship accelerates early stage growth',
      status: 'published' as const,
      created_at: new Date().toISOString(),
    };
    blogDatabase.push(postWithImage);

    const saved = blogDatabase.find(p => p.id === 'post-3');
    assert.ok(saved);
    assert.equal(saved.featured_image, publicUrl);
  });

  // ==========================================================================
  // Test 4: Developer Admin can upload an image to blog-images and attach to blog post
  // ==========================================================================
  test('4. Developer Admin can upload an image to blog-images and attach to blog post', () => {
    // Step 1: Storage Upload
    const canUpload = evaluateStorageOperation(devAdminUser, devAdminProfile, 'blog-images', 'INSERT');
    assert.equal(canUpload, true, 'Developer Admin must be permitted to upload to blog-images');

    const imageObject = {
      id: 'obj-2',
      bucket_id: 'blog-images',
      name: 'blog-devadmin-metric.png',
      owner: devAdminUser.id,
      created_at: new Date().toISOString(),
    };
    storageObjects.push(imageObject);

    const publicUrl = `https://rfyxnshvtfswvaogjzwq.supabase.co/storage/v1/object/public/blog-images/${imageObject.name}`;

    // Step 2: Blog Insert with Image
    const canInsert = evaluateBlogOperation(devAdminUser, devAdminProfile, 'INSERT');
    assert.equal(canInsert, true);

    const postWithImage = {
      id: 'post-4',
      title: 'Engineering Best Practices 2026',
      content: 'Engineering best practices breakdown...',
      featured_image: publicUrl,
      meta_title: 'Engineering Best Practices',
      meta_description: 'Code and cloud deployment tips',
      status: 'published' as const,
      created_at: new Date().toISOString(),
    };
    blogDatabase.push(postWithImage);

    const saved = blogDatabase.find(p => p.id === 'post-4');
    assert.ok(saved);
    assert.equal(saved.featured_image, publicUrl);
  });

  // ==========================================================================
  // Test 5: Non-admins (Clients, Consultants, Anonymous) CANNOT insert blog posts
  // ==========================================================================
  test('5. Non-admins (Clients, Consultants, Anonymous) CANNOT insert blog posts', () => {
    assert.equal(evaluateBlogOperation(clientUser, clientProfile, 'INSERT'), false, 'Client must NOT insert blog posts');
    assert.equal(evaluateBlogOperation(consultantUser, consultantProfile, 'INSERT'), false, 'Consultant must NOT insert blog posts');
    assert.equal(evaluateBlogOperation(null, null, 'INSERT'), false, 'Anonymous must NOT insert blog posts');
  });

  // ==========================================================================
  // Test 6: Non-admins (Clients, Consultants, Anonymous) CANNOT upload to blog-images
  // ==========================================================================
  test('6. Non-admins (Clients, Consultants, Anonymous) CANNOT upload to blog-images', () => {
    assert.equal(evaluateStorageOperation(clientUser, clientProfile, 'blog-images', 'INSERT'), false, 'Client must NOT upload to blog-images');
    assert.equal(evaluateStorageOperation(consultantUser, consultantProfile, 'blog-images', 'INSERT'), false, 'Consultant must NOT upload to blog-images');
    assert.equal(evaluateStorageOperation(null, null, 'blog-images', 'INSERT'), false, 'Anonymous must NOT upload to blog-images');
  });

  // ==========================================================================
  // Test 7: Public and anonymous visitors CAN view published posts and images
  // ==========================================================================
  test('7. Public and anonymous visitors CAN view published posts and images', () => {
    const publishedPost = blogDatabase.find(p => p.status === 'published')!;
    assert.equal(evaluateBlogOperation(null, null, 'SELECT', publishedPost), true, 'Anonymous can view published posts');
    assert.equal(evaluateBlogOperation(clientUser, clientProfile, 'SELECT', publishedPost), true, 'Client can view published posts');
    assert.equal(evaluateStorageOperation(null, null, 'blog-images', 'SELECT'), true, 'Anonymous can view public blog images');
  });

  // ==========================================================================
  // Test 8: Non-admins CANNOT view draft blog posts; Admins CAN view draft posts
  // ==========================================================================
  test('8. Non-admins CANNOT view draft blog posts; Admins CAN view draft posts', () => {
    const draftPost = blogDatabase.find(p => p.status === 'draft')!;
    assert.ok(draftPost, 'Draft post should exist');

    assert.equal(evaluateBlogOperation(null, null, 'SELECT', draftPost), false, 'Anonymous must NOT see draft posts');
    assert.equal(evaluateBlogOperation(clientUser, clientProfile, 'SELECT', draftPost), false, 'Client must NOT see draft posts');
    assert.equal(evaluateBlogOperation(consultantUser, consultantProfile, 'SELECT', draftPost), false, 'Consultant must NOT see draft posts');

    assert.equal(evaluateBlogOperation(superAdminUser, superAdminProfile, 'SELECT', draftPost), true, 'Super Admin CAN see draft posts');
    assert.equal(evaluateBlogOperation(devAdminUser, devAdminProfile, 'SELECT', draftPost), true, 'Developer Admin CAN see draft posts');
  });

  // ==========================================================================
  // Test 9: Super Admin and Developer Admin can update and delete blog posts and images
  // ==========================================================================
  test('9. Super Admin and Developer Admin can update and delete blog posts and images', () => {
    // Super Admin Update & Delete
    assert.equal(evaluateBlogOperation(superAdminUser, superAdminProfile, 'UPDATE'), true);
    assert.equal(evaluateBlogOperation(superAdminUser, superAdminProfile, 'DELETE'), true);
    assert.equal(evaluateStorageOperation(superAdminUser, superAdminProfile, 'blog-images', 'UPDATE'), true);
    assert.equal(evaluateStorageOperation(superAdminUser, superAdminProfile, 'blog-images', 'DELETE'), true);

    // Developer Admin Update & Delete
    assert.equal(evaluateBlogOperation(devAdminUser, devAdminProfile, 'UPDATE'), true);
    assert.equal(evaluateBlogOperation(devAdminUser, devAdminProfile, 'DELETE'), true);
    assert.equal(evaluateStorageOperation(devAdminUser, devAdminProfile, 'blog-images', 'UPDATE'), true);
    assert.equal(evaluateStorageOperation(devAdminUser, devAdminProfile, 'blog-images', 'DELETE'), true);

    // Clients & Consultants cannot update or delete
    assert.equal(evaluateBlogOperation(clientUser, clientProfile, 'UPDATE'), false);
    assert.equal(evaluateBlogOperation(clientUser, clientProfile, 'DELETE'), false);
    assert.equal(evaluateStorageOperation(clientUser, clientProfile, 'blog-images', 'UPDATE'), false);
    assert.equal(evaluateStorageOperation(clientUser, clientProfile, 'blog-images', 'DELETE'), false);
  });

  // ==========================================================================
  // Test 10: getSafeDatabaseErrorMessage handles Supabase RLS, Storage, and Secret errors
  // ==========================================================================
  test('10. getSafeDatabaseErrorMessage handles Supabase RLS, Storage, and Secret errors', () => {
    // 10a. RLS Policy Error (PostgreSQL 42501)
    const rlsError = {
      code: '42501',
      message: 'new row violates row-level security policy for table "blog"',
      details: null,
      hint: null,
    };
    const rlsMsg = getSafeDatabaseErrorMessage(rlsError);
    assert.match(rlsMsg, /Permission denied by Row Level Security/);
    assert.match(rlsMsg, /Super Admin or Developer Admin/);

    // 10b. Storage RLS Error (HTTP 403)
    const storageRlsError = {
      statusCode: 403,
      message: 'new row violates row-level security policy for table "objects"',
    };
    const storageMsg = getSafeDatabaseErrorMessage(storageRlsError);
    assert.match(storageMsg, /Permission denied by Row Level Security/);

    // 10c. Storage Bucket Missing Error
    const bucketNotFoundError = {
      statusCode: 404,
      message: 'Bucket not found',
    };
    const bucketMsg = getSafeDatabaseErrorMessage(bucketNotFoundError);
    assert.match(bucketMsg, /Storage bucket not found or inaccessible/);

    // 10d. Duplicate Constraint Violation (PostgreSQL 23505)
    const duplicateError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "blog_slug_key"',
    };
    const dupMsg = getSafeDatabaseErrorMessage(duplicateError);
    assert.match(dupMsg, /record with this identifier already exists/);

    // 10e. Security Sanitization: Error containing secret tokens must NOT leak to user
    const secretLeakError = {
      message: 'Failed authorization with service_role secret Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretKey123',
    };
    const sanitizedMsg = getSafeDatabaseErrorMessage(secretLeakError, 'Safe Fallback Message');
    assert.equal(sanitizedMsg, 'Safe Fallback Message', 'Must not leak secret bearer tokens in error message');

    // 10f. Clean human-readable error messages are preserved
    const humanError = new Error('Title must be at least 5 characters');
    assert.equal(getSafeDatabaseErrorMessage(humanError), 'Title must be at least 5 characters');
  });

  // ==========================================================================
  // Test 11: Two-step failure isolation: Storage failure stops execution before DB insert
  // ==========================================================================
  test('11. Two-step failure isolation: Storage failure stops execution before DB insert', async () => {
    let dbInsertCalled = false;

    // Simulate AdminBlog handleSave logic
    async function simulateHandleSave(hasImage: boolean, shouldStorageFail: boolean, shouldDbFail: boolean) {
      let featuredImage: string | null = null;

      // Failure Point 1: Storage Upload
      if (hasImage) {
        if (shouldStorageFail) {
          throw new Error('Storage bucket "blog-images" RLS error: forbidden');
        }
        featuredImage = 'https://example.com/uploaded.png';
      }

      // Failure Point 2: Database Save
      if (shouldDbFail) {
        throw new Error('Database RLS error: code 42501');
      }

      dbInsertCalled = true;
      return { success: true, featuredImage };
    }

    // Run A: Storage fails -> DB insert must NOT be called
    dbInsertCalled = false;
    let failureStep = 'none';
    try {
      await simulateHandleSave(true, true, false);
    } catch (err: any) {
      failureStep = 'image_upload';
      const safe = getSafeDatabaseErrorMessage(err);
      assert.ok(safe);
    }
    assert.equal(failureStep, 'image_upload');
    assert.equal(dbInsertCalled, false, 'DB insert must not be executed if storage upload failed');

    // Run B: Storage succeeds, DB fails -> Caught as database save error
    dbInsertCalled = false;
    try {
      await simulateHandleSave(true, false, true);
    } catch (err: any) {
      failureStep = 'database_save';
      const safe = getSafeDatabaseErrorMessage(err);
      assert.ok(safe);
    }
    assert.equal(failureStep, 'database_save');

    // Run C: Text-only post (no image) -> Storage skipped, DB succeeds
    dbInsertCalled = false;
    const result = await simulateHandleSave(false, false, false);
    assert.equal(result.success, true);
    assert.equal(result.featuredImage, null);
    assert.equal(dbInsertCalled, true);
  });
});
