module patreon::content {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
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
        is_pay_per_view: bool,
        ppv_price: u64,
        created_at: u64,
        content_type: String,
        is_archived: bool,
    }

    /// One-time Purchase Access NFT
    public struct ContentAccess has key, store {
        id: UID,
        content_id: ID,
        owner: address,
        purchased_at: u64,
    }

    /// Event when content is created
    public struct ContentCreated has copy, drop {
        content_id: ID,
        creator: address,
        title: String,
        is_public: bool,
    }

    /// Event when content is purchased
    public struct ContentPurchased has copy, drop {
        content_id: ID,
        buyer: address,
        price: u64,
    }

    /// Error codes
    const EInsufficientPayment: u64 = 0;
    const ENoAccess: u64 = 1;
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
        is_pay_per_view: bool,
        ppv_price: u64,
        content_type: String,
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
            is_pay_per_view,
            ppv_price,
            created_at: clock::timestamp_ms(clock),
            content_type,
            is_archived: false,
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

    /// Purchase content (pay-per-view)
    public entry fun purchase_content(
        content: &ContentPost,
        profile: &mut CreatorProfile,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        assert!(content.is_pay_per_view, ENoAccess);
        assert!(coin::value(&payment) >= content.ppv_price, EInsufficientPayment);

        // Transfer payment to creator
        transfer::public_transfer(payment, content.creator);

        // Create access NFT
        let access = ContentAccess {
            id: object::new(ctx),
            content_id: object::id(content),
            owner: sender,
            purchased_at: clock::timestamp_ms(clock),
        };

        // Add revenue to creator profile
        creator_profile::add_revenue(profile, content.ppv_price);

        event::emit(ContentPurchased {
            content_id: object::id(content),
            buyer: sender,
            price: content.ppv_price,
        });

        transfer::transfer(access, sender);
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

    /// Check if user has purchased access
    public fun has_purchased_access(
        content: &ContentPost,
        access: &ContentAccess
    ): bool {
        access.content_id == object::id(content)
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

    public fun get_ppv_price(content: &ContentPost): u64 {
        content.ppv_price
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
}

