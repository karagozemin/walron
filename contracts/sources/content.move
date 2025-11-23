module patreon::content {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use std::string::String;
    use sui::event;
    use patreon::subscription::{Self, Subscription};
    use patreon::creator_profile::{Self, CreatorProfile};

    /// Content Post - represents a piece of content
    public struct ContentPost has key, store {
        id: UID,
        creator_profile_id: ID,
        creator: address,
        title: String,
        description: String,
        walrus_blob_id: String,
        seal_policy_id: String,
        required_tier_id: ID,
        is_public: bool,
        created_at: u64,
        content_type: String,
        is_archived: bool,
        encryption_key: String, // Base64 encoded key for this specific content
    }

    /// Event when content is created
    public struct ContentCreated has copy, drop {
        content_id: ID,
        creator: address,
        title: String,
        is_public: bool,
    }

    /// Error codes
    const ENotCreator: u64 = 2;

    /// Create new content post
    public entry fun create_content(
        profile: &CreatorProfile,
        title: String,
        description: String,
        walrus_blob_id: String,
        seal_policy_id: String,
        required_tier_id: ID,
        is_public: bool,
        content_type: String,
        encryption_key: String, // Base64 encoded key for this content
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let creator = creator_profile::get_owner(profile);
        
        assert!(sender == creator, ENotCreator);

        let content = ContentPost {
            id: object::new(ctx),
            creator_profile_id: object::id(profile),
            creator,
            title,
            description,
            walrus_blob_id,
            seal_policy_id,
            required_tier_id,
            is_public,
            created_at: clock::timestamp_ms(clock),
            content_type,
            is_archived: false,
            encryption_key,
        };

        let content_id = object::id(&content);

        event::emit(ContentCreated {
            content_id,
            creator,
            title: content.title,
            is_public,
        });

        transfer::share_object(content);
    }

    /// Check if user has access to content
    public fun has_subscription_access(
        content: &ContentPost,
        subscription: &Subscription,
        clock: &Clock
    ): bool {
        // Check if subscription is for the same creator
        if (subscription::get_creator(subscription) != content.creator) {
            return false
        };

        // Check if subscription is active
        if (!subscription::is_active(subscription, clock)) {
            return false
        };

        // Check if subscription tier matches required tier
        // Note: In production, you'd want tier hierarchy checking
        subscription::get_tier_id(subscription) == content.required_tier_id
    }

    /// Get content details
    public fun get_creator(content: &ContentPost): address {
        content.creator
    }

    public fun get_walrus_blob_id(content: &ContentPost): String {
        content.walrus_blob_id
    }

    public fun get_seal_policy_id(content: &ContentPost): String {
        content.seal_policy_id
    }

    public fun is_public(content: &ContentPost): bool {
        content.is_public
    }

    public fun get_required_tier_id(content: &ContentPost): ID {
        content.required_tier_id
    }

    /// Update content metadata
    public entry fun update_content(
        content: &mut ContentPost,
        title: String,
        description: String,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == content.creator, ENotCreator);
        
        content.title = title;
        content.description = description;
    }

    /// Archive content (hide from public view)
    public entry fun archive_content(
        content: &mut ContentPost,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == content.creator, ENotCreator);
        
        content.is_archived = true;
    }

    /// Unarchive content (restore to public view)
    public entry fun unarchive_content(
        content: &mut ContentPost,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == content.creator, ENotCreator);
        
        content.is_archived = false;
    }

    /// Check if content is archived
    public fun is_archived(content: &ContentPost): bool {
        content.is_archived
    }

    /// Get encryption key for content
    public fun get_encryption_key(content: &ContentPost): String {
        content.encryption_key
    }
}

