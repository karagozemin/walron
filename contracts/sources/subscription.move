module patreon::subscription {
    use sui::object::{Self, UID, ID};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use std::string::String;
    use sui::event;
    use patreon::creator_profile::{Self, CreatorProfile};

    /// Subscription Tier - defines pricing and benefits
    public struct SubscriptionTier has key, store {
        id: UID,
        creator_profile_id: ID,
        creator: address,
        name: String,
        description: String,
        price_per_month: u64,
        max_subscribers: u64,
        current_subscribers: u64,
    }

    /// Active Subscription NFT - proves membership
    public struct Subscription has key, store {
        id: UID,
        tier_id: ID,
        subscriber: address,
        creator: address,
        started_at: u64,
        expires_at: u64,
    }

    /// Event when tier is created
    public struct TierCreated has copy, drop {
        tier_id: ID,
        creator: address,
        name: String,
        price: u64,
    }

    /// Event when user subscribes
    public struct Subscribed has copy, drop {
        subscription_id: ID,
        tier_id: ID,
        subscriber: address,
        creator: address,
        expires_at: u64,
    }

    /// Event when subscription is cancelled
    public struct Cancelled has copy, drop {
        subscription_id: ID,
        subscriber: address,
    }

    /// Error codes
    const EInsufficientPayment: u64 = 0;
    const EMaxSubscribersReached: u64 = 1;
    const ESubscriptionExpired: u64 = 2;
    const ENotSubscriber: u64 = 3;

    /// Create a new subscription tier
    public entry fun create_tier(
        profile: &CreatorProfile,
        name: String,
        description: String,
        price_per_month: u64,
        max_subscribers: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let creator = creator_profile::get_owner(profile);
        
        assert!(sender == creator, ENotSubscriber);

        let tier = SubscriptionTier {
            id: object::new(ctx),
            creator_profile_id: object::id(profile),
            creator,
            name,
            description,
            price_per_month,
            max_subscribers,
            current_subscribers: 0,
        };

        let tier_id = object::id(&tier);

        event::emit(TierCreated {
            tier_id,
            creator,
            name: tier.name,
            price: price_per_month,
        });

        transfer::share_object(tier);
    }

    /// Subscribe to a tier
    public entry fun subscribe(
        tier: &mut SubscriptionTier,
        profile: &mut CreatorProfile,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Check payment amount
        assert!(coin::value(&payment) >= tier.price_per_month, EInsufficientPayment);
        
        // Check subscriber limit
        assert!(tier.current_subscribers < tier.max_subscribers, EMaxSubscribersReached);

        // Transfer payment to creator
        transfer::public_transfer(payment, tier.creator);

        // Calculate expiration (30 days from now)
        let current_time = clock::timestamp_ms(clock);
        let expires_at = current_time + (30 * 24 * 60 * 60 * 1000); // 30 days in ms

        // Create subscription NFT
        let subscription = Subscription {
            id: object::new(ctx),
            tier_id: object::id(tier),
            subscriber: sender,
            creator: tier.creator,
            started_at: current_time,
            expires_at,
        };

        let subscription_id = object::id(&subscription);

        // Update counts
        tier.current_subscribers = tier.current_subscribers + 1;
        creator_profile::increment_subscribers(profile);
        creator_profile::add_revenue(profile, tier.price_per_month);

        event::emit(Subscribed {
            subscription_id,
            tier_id: object::id(tier),
            subscriber: sender,
            creator: tier.creator,
            expires_at,
        });

        transfer::transfer(subscription, sender);
    }

    /// Renew subscription
    public entry fun renew(
        subscription: &mut Subscription,
        tier: &SubscriptionTier,
        profile: &mut CreatorProfile,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(subscription.subscriber == sender, ENotSubscriber);
        assert!(coin::value(&payment) >= tier.price_per_month, EInsufficientPayment);

        // Transfer payment
        transfer::public_transfer(payment, tier.creator);

        // Extend expiration
        let current_time = clock::timestamp_ms(clock);
        subscription.expires_at = current_time + (30 * 24 * 60 * 60 * 1000);

        // Add revenue
        creator_profile::add_revenue(profile, tier.price_per_month);
    }

    /// Cancel subscription (burn NFT)
    public entry fun cancel(
        subscription: Subscription,
        tier: &mut SubscriptionTier,
        profile: &mut CreatorProfile,
    ) {
        let Subscription { id, tier_id: _, subscriber, creator: _, started_at: _, expires_at: _ } = subscription;

        // Update counts
        tier.current_subscribers = tier.current_subscribers - 1;
        creator_profile::decrement_subscribers(profile);

        event::emit(Cancelled {
            subscription_id: object::uid_to_inner(&id),
            subscriber,
        });

        object::delete(id);
    }

    /// Check if subscription is active
    public fun is_active(subscription: &Subscription, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock);
        current_time < subscription.expires_at
    }

    /// Get subscription details
    public fun get_tier_id(subscription: &Subscription): ID {
        subscription.tier_id
    }

    public fun get_subscriber(subscription: &Subscription): address {
        subscription.subscriber
    }

    public fun get_creator(subscription: &Subscription): address {
        subscription.creator
    }

    public fun get_expires_at(subscription: &Subscription): u64 {
        subscription.expires_at
    }

    /// Get tier details
    public fun get_tier_price(tier: &SubscriptionTier): u64 {
        tier.price_per_month
    }

    public fun get_tier_creator(tier: &SubscriptionTier): address {
        tier.creator
    }
}

