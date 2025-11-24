"use client";

import { useState, useRef, useEffect } from "react";
import { ConnectButton, useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import Link from "next/link";
import { clearSessionCache } from "@/lib/seal/session-cache";
import { clearAllContentCache } from "@/lib/cache/indexed-db-cache";
import { getUserSuiNS, formatDisplayName } from "@/lib/suins/client";
import { suiClient } from "@/lib/sui/client";
import { PACKAGE_ID } from "@/lib/sui/config";

export function WalletButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [suinsName, setSuinsName] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch SuiNS name and handle when account changes
  useEffect(() => {
    let cancelled = false;
    
    if (account?.address) {
      // Fetch SuiNS
      getUserSuiNS(account.address, suiClient).then((name) => {
        if (!cancelled) {
          setSuinsName(name);
        }
      });
      
      // Fetch handle from profile
      const fetchHandle = async () => {
        try {
          const events = await suiClient.queryEvents({
            query: {
              MoveEventType: `${PACKAGE_ID}::creator_profile::ProfileCreated`,
            },
            limit: 50,
          });
          
          const userProfile = events.data.find(
            (event: any) => event.parsedJson?.owner === account.address
          );
          
          if (userProfile && userProfile.parsedJson) {
            const profileId = (userProfile.parsedJson as any).profile_id;
            const profileObj = await suiClient.getObject({
              id: profileId,
              options: { showContent: true },
            });
            
            if (profileObj.data?.content?.dataType === "moveObject") {
              const fields = profileObj.data.content.fields as any;
              if (!cancelled) {
                setHandle(fields.handle || null);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching handle:', error);
        }
      };
      
      fetchHandle();
    } else if (!cancelled) {
      setSuinsName(null);
      setHandle(null);
    }
    
    return () => {
      cancelled = true;
    };
  }, [account?.address]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!account) {
    return <ConnectButton />;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
      >
        <div className="w-7 h-7 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-sm">
          {suinsName ? suinsName[0].toUpperCase() : account.address.slice(2, 4).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {formatDisplayName(account.address, suinsName)}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg z-50">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            {suinsName ? (
              <>
                <div className="text-xs text-slate-500 dark:text-slate-500 mb-1">SuiNS Name</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-1">
                  {suinsName}
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500 mb-1">Wallet Address</div>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">
                  {account.address}
                </div>
              </>
            ) : (
              <>
            <div className="text-xs text-slate-500 dark:text-slate-500 mb-1">Connected Wallet</div>
            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {account.address}
            </div>
              </>
            )}
          </div>

          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Profile
            </Link>

            <Link
              href={`/creator/${suinsName || handle || account.address}`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Public Profile
            </Link>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 py-1">
            <button
              onClick={() => {
                clearSessionCache(); // Clear Seal SessionKey cache
                clearAllContentCache(); // Clear IndexedDB content cache
                disconnect();
                setIsOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

