/**
 * Supabase Admin Helper
 * Provides fallback CRUD operations for guides and users when Sequelize is unavailable.
 * Used in serverless environments (Vercel) where DATABASE_URL may not be configured.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabaseAdmin = null;
let isConfigured = false;

// Initialize Supabase admin client
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    isConfigured = true;
    console.log('✅ Supabase Admin client initialized for fallback operations');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase Admin client:', error.message);
  }
} else {
  console.warn('⚠️  Supabase Admin not configured - SUPABASE_URL or SUPABASE_SERVICE_KEY missing');
}

/**
 * Check if Supabase fallback is available
 */
function isAvailable() {
  return isConfigured && supabaseAdmin !== null;
}

// ============ USER OPERATIONS ============

/**
 * Get user by ID from Supabase auth
 */
async function getUserById(userId) {
  if (!isAvailable()) {
    console.warn('⚠️  Supabase Admin not available for getUserById');
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      console.error('❌ Supabase getUserById error:', error.message);
      return null;
    }

    if (!user) return null;

    // Transform to match Sequelize User model shape
    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      subscription: user.user_metadata?.subscription || 'free',
      guidesUsed: user.user_metadata?.guidesUsed || 0,
      guidesLimit: user.user_metadata?.guidesLimit || 3,
      betaAccessLevel: user.user_metadata?.betaAccessLevel || 'none',
      isBetaTester: user.user_metadata?.isBetaTester || false,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  } catch (error) {
    console.error('❌ getUserById exception:', error.message);
    return null;
  }
}

/**
 * Update user metadata in Supabase auth
 */
async function updateUserMetadata(userId, metadata) {
  if (!isAvailable()) {
    console.warn('⚠️  Supabase Admin not available for updateUserMetadata');
    return false;
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: metadata
    });

    if (error) {
      console.error('❌ Supabase updateUserMetadata error:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ updateUserMetadata exception:', error.message);
    return false;
  }
}

// ============ GUIDE OPERATIONS ============

/**
 * List guides for a user
 */
async function listGuidesByUser(userId, options = {}) {
  if (!isAvailable()) {
    console.warn('⚠️  Supabase Admin not available for listGuidesByUser');
    return [];
  }

  try {
    let query = supabaseAdmin
      .from('Guides')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (options.isFavorite !== undefined) {
      query = query.eq('isFavorite', options.isFavorite);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Supabase listGuidesByUser error:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ listGuidesByUser exception:', error.message);
    return [];
  }
}

/**
 * Get a single guide by ID
 */
async function getGuideById(guideId, userId = null) {
  if (!isAvailable()) {
    console.warn('⚠️  Supabase Admin not available for getGuideById');
    return null;
  }

  try {
    let query = supabaseAdmin
      .from('Guides')
      .select('*')
      .eq('id', guideId);

    if (userId) {
      query = query.eq('userId', userId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('❌ Supabase getGuideById error:', error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ getGuideById exception:', error.message);
    return null;
  }
}

/**
 * Insert a new guide
 */
async function insertGuide(guideData) {
  if (!isAvailable()) {
    console.warn('⚠️  Supabase Admin not available for insertGuide');
    return null;
  }

  try {
    // Generate UUID if not provided
    const id = guideData.id || crypto.randomUUID();

    const { data, error } = await supabaseAdmin
      .from('Guides')
      .insert({
        id,
        guideId: guideData.guideId,
        userId: guideData.userId,
        characterName: guideData.characterName,
        productionTitle: guideData.productionTitle,
        productionType: guideData.productionType,
        productionTone: guideData.productionTone || null,
        stakes: guideData.stakes || null,
        roleSize: guideData.roleSize || 'Supporting',
        genre: guideData.genre || 'Drama',
        storyline: guideData.storyline || null,
        characterBreakdown: guideData.characterBreakdown || null,
        callbackNotes: guideData.callbackNotes || null,
        focusArea: guideData.focusArea || null,
        sceneText: guideData.sceneText,
        generatedHtml: guideData.generatedHtml,
        childGuideRequested: guideData.childGuideRequested || false,
        childGuideHtml: guideData.childGuideHtml || null,
        childGuideCompleted: guideData.childGuideCompleted || false,
        shareUrl: guideData.shareUrl || null,
        isPublic: guideData.isPublic || false,
        viewCount: guideData.viewCount || 0,
        isFavorite: guideData.isFavorite || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase insertGuide error:', error.message);
      return null;
    }

    console.log(`✅ Guide inserted via Supabase: ${data.id}`);
    return data;
  } catch (error) {
    console.error('❌ insertGuide exception:', error.message);
    return null;
  }
}

/**
 * Update an existing guide
 */
async function updateGuide(guideId, updates, userId = null) {
  if (!isAvailable()) {
    console.warn('⚠️  Supabase Admin not available for updateGuide');
    return null;
  }

  try {
    let query = supabaseAdmin
      .from('Guides')
      .update({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .eq('id', guideId);

    if (userId) {
      query = query.eq('userId', userId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error('❌ Supabase updateGuide error:', error.message);
      return null;
    }

    console.log(`✅ Guide updated via Supabase: ${guideId}`);
    return data;
  } catch (error) {
    console.error('❌ updateGuide exception:', error.message);
    return null;
  }
}

/**
 * Delete a guide
 */
async function deleteGuide(guideId, userId) {
  if (!isAvailable()) {
    console.warn('⚠️  Supabase Admin not available for deleteGuide');
    return false;
  }

  try {
    const { error } = await supabaseAdmin
      .from('Guides')
      .delete()
      .eq('id', guideId)
      .eq('userId', userId);

    if (error) {
      console.error('❌ Supabase deleteGuide error:', error.message);
      return false;
    }

    console.log(`✅ Guide deleted via Supabase: ${guideId}`);
    return true;
  } catch (error) {
    console.error('❌ deleteGuide exception:', error.message);
    return false;
  }
}

/**
 * Increment guide view count
 */
async function incrementViewCount(guideId) {
  if (!isAvailable()) {
    return false;
  }

  try {
    const { error } = await supabaseAdmin.rpc('increment_view_count', {
      guide_id: guideId
    });

    // If RPC doesn't exist, fall back to fetch + update
    if (error) {
      const guide = await getGuideById(guideId);
      if (guide) {
        await updateGuide(guideId, { viewCount: (guide.viewCount || 0) + 1 });
      }
    }

    return true;
  } catch (error) {
    console.error('❌ incrementViewCount exception:', error.message);
    return false;
  }
}

/**
 * Get public guides
 */
async function listPublicGuides(options = {}) {
  if (!isAvailable()) {
    return { guides: [], count: 0 };
  }

  try {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    // Get count
    const { count } = await supabaseAdmin
      .from('Guides')
      .select('*', { count: 'exact', head: true })
      .eq('isPublic', true);

    // Get data
    const { data, error } = await supabaseAdmin
      .from('Guides')
      .select('id, characterName, productionTitle, productionType, createdAt, viewCount')
      .eq('isPublic', true)
      .order(options.sortBy || 'createdAt', { ascending: options.order === 'ASC' })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Supabase listPublicGuides error:', error.message);
      return { guides: [], count: 0 };
    }

    return { guides: data || [], count: count || 0 };
  } catch (error) {
    console.error('❌ listPublicGuides exception:', error.message);
    return { guides: [], count: 0 };
  }
}

module.exports = {
  isAvailable,
  // User operations
  getUserById,
  updateUserMetadata,
  // Guide operations
  listGuidesByUser,
  getGuideById,
  insertGuide,
  updateGuide,
  deleteGuide,
  incrementViewCount,
  listPublicGuides
};
