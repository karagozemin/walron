module patreon::payment {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use std::string::String;
    use patreon::creator_profile::{Self, CreatorProfile};

    /// Event when tip is sent
    public struct TipSent has copy, drop {
        tipper: address,
        creator: address,
        amount: u64,
        message: String,
    }

    /// Event for withdrawal
    public struct Withdrawn has copy, drop {
        creator: address,
        amount: u64,
    }

    /// Send a tip to creator
    public entry fun send_tip(
        profile: &mut CreatorProfile,
        tip: Coin<SUI>,
        message: String,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let creator = creator_profile::get_owner(profile);
        let amount = coin::value(&tip);
        
        // Transfer tip to creator
        transfer::public_transfer(tip, creator);

        // Add to revenue tracking
        creator_profile::add_revenue(profile, amount);

        event::emit(TipSent {
            tipper: sender,
            creator,
            amount,
            message,
        });
    }

    /// Send tip with custom message
    public entry fun send_tip_simple(
        creator: address,
        tip: Coin<SUI>,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let amount = coin::value(&tip);
        
        transfer::public_transfer(tip, creator);

        event::emit(TipSent {
            tipper: sender,
            creator,
            amount,
            message: std::string::utf8(b""),
        });
    }
}

