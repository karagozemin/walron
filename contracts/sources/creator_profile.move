module patreon::creator_profile {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use std::string::String;
    use sui::event;

    /// Creator Profile NFT - represents a creator's identity
    public struct CreatorProfile has key, store {
        id: UID,
        owner: address,
        handle: String,
        bio: String,
        profile_image_blob_id: String,
        banner_image_blob_id: String,
        created_at: u64,
        total_subscribers: u64,
        total_revenue: u64,
    }

    /// Capability for profile management - proves ownership
    public struct CreatorCap has key, store {
        id: UID,
        profile_id: ID,
    }

    /// Event emitted when a new creator profile is created
    public struct ProfileCreated has copy, drop {
        profile_id: ID,
        owner: address,
        handle: String,
    }

    /// Event emitted when profile is updated
    public struct ProfileUpdated has copy, drop {
        profile_id: ID,
        owner: address,
    }

    /// Create a new creator profile
    public entry fun create_profile(
        handle: String,
        bio: String,
        profile_image_blob_id: String,
        banner_image_blob_id: String,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        let profile = CreatorProfile {
            id: object::new(ctx),
            owner: sender,
            handle,
            bio,
            profile_image_blob_id,
            banner_image_blob_id,
            created_at: tx_context::epoch(ctx),
            total_subscribers: 0,
            total_revenue: 0,
        };
        
        let profile_id = object::id(&profile);
        
        let cap = CreatorCap {
            id: object::new(ctx),
            profile_id,
        };

        event::emit(ProfileCreated {
            profile_id,
            owner: sender,
            handle: profile.handle,
        });

        transfer::share_object(profile);
        transfer::transfer(cap, sender);
    }

    /// Update profile information
    public entry fun update_profile(
        profile: &mut CreatorProfile,
        _cap: &CreatorCap,
        bio: String,
        profile_image_blob_id: String,
        banner_image_blob_id: String,
        ctx: &TxContext
    ) {
        profile.bio = bio;
        profile.profile_image_blob_id = profile_image_blob_id;
        profile.banner_image_blob_id = banner_image_blob_id;

        event::emit(ProfileUpdated {
            profile_id: object::id(profile),
            owner: tx_context::sender(ctx),
        });
    }

    /// Increment subscriber count (called by subscription module)
    public(package) fun increment_subscribers(profile: &mut CreatorProfile) {
        profile.total_subscribers = profile.total_subscribers + 1;
    }

    /// Decrement subscriber count (called by subscription module)
    public(package) fun decrement_subscribers(profile: &mut CreatorProfile) {
        if (profile.total_subscribers > 0) {
            profile.total_subscribers = profile.total_subscribers - 1;
        };
    }

    /// Add revenue (called by payment module)
    public(package) fun add_revenue(profile: &mut CreatorProfile, amount: u64) {
        profile.total_revenue = profile.total_revenue + amount;
    }

    /// Get profile owner
    public fun get_owner(profile: &CreatorProfile): address {
        profile.owner
    }

    /// Get profile ID from capability
    public fun get_profile_id(cap: &CreatorCap): ID {
        cap.profile_id
    }

    /// Get total subscribers
    public fun get_total_subscribers(profile: &CreatorProfile): u64 {
        profile.total_subscribers
    }

    /// Get total revenue
    public fun get_total_revenue(profile: &CreatorProfile): u64 {
        profile.total_revenue
    }
}

