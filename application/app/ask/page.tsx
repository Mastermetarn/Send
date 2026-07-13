"use client";

import React, { useEffect, useRef, useState } from "react";
import {
    decryptTextFromRecipient,
    exportPrivateKey,
    exportPublicKey,
    generateRecipientKeyPair,
    importPrivateKey,
} from "@/lib/e2ee";
import { appApiPath } from "@/lib/paths";

type RawMessage = {
    id: number;
    content: string;
    encryptedKey: string | null;
    iv: string | null;
    createdAt: number;
};

type DisplayMessage = {
    id: number;
    content: string;
    createdAt: number;
};

const PRIVATE_KEY_STORAGE_PREFIX = "send:e2ee:private-key:";

function storageKey(linkId: string) {
    return `${PRIVATE_KEY_STORAGE_PREFIX}${linkId}`;
}

function extractLinkId(url: string) {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? null;
}

export default function CreatePage() {
    const [url, setUrl] = useState<string | null>(null);
    const [linkId, setLinkId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [oneTimeRead, setOneTimeRead] = useState(false);
    const [persistPrivateKey, setPersistPrivateKey] = useState(false);
    const [rawMessages, setRawMessages] = useState<RawMessage[]>([]);
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [messageCount, setMessageCount] = useState<number>(0);
    const [showReadButton, setShowReadButton] = useState(false);
    const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
    const [keyStatus, setKeyStatus] = useState<string | null>(null);
    const esRef = useRef<EventSource | null>(null);
    const hasActiveLink = url !== null;

    async function loadStoredPrivateKey(targetLinkId: string) {
        if (privateKey) {
            return privateKey;
        }

        if (typeof window === "undefined") {
            return null;
        }

        const stored = window.localStorage.getItem(storageKey(targetLinkId));
        if (!stored) {
            setKeyStatus("Private key is only in this tab unless you enable persistence.");
            return null;
        }

        try {
            const imported = await importPrivateKey(stored);
            setPrivateKey(imported);
            setKeyStatus("Private key loaded from local storage.");
            return imported;
        } catch {
            setKeyStatus("Saved private key could not be loaded.");
            return null;
        }
    }

    async function fetchMessages(id?: string) {
        const targetId = id ?? linkId;
        if (!targetId) return;

        const res = await fetch(appApiPath(`/s/${targetId}/messages`));
        if (!res.ok) return;

        const data = await res.json();
        const count = typeof data.messageCount === "number" ? data.messageCount : 0;

        setMessageCount(count);
        setShowReadButton(Boolean(data.oneTimeRead) && count > 0);

        if (data.oneTimeRead) {
            setRawMessages([]);
            setMessages([]);
            return count;
        }

        setRawMessages((data.messages ?? []) as RawMessage[]);
        return count;
    }

    async function readOneTimeMessages(id?: string) {
        const targetId = id ?? linkId;
        if (!targetId) return;

        const res = await fetch(appApiPath(`/s/${targetId}/messages`), {
            method: "POST",
        });

        if (!res.ok) return;

        const data = await res.json();
        setRawMessages((prev) => [...prev, ...((data.messages ?? []) as RawMessage[])]);
        setMessageCount(typeof data.messageCount === "number" ? data.messageCount : (data.messages ?? []).length);
        setShowReadButton(false);
    }

    async function deleteLink() {
        const res = await fetch(appApiPath("/ask/delete"), { method: "POST" });
        if (!res.ok) return;

        if (linkId && typeof window !== "undefined") {
            window.localStorage.removeItem(storageKey(linkId));
        }

        setLinkId(null);
        setUrl(null);
        setOneTimeRead(false);
        setPersistPrivateKey(false);
        setRawMessages([]);
        setMessages([]);
        setMessageCount(0);
        setShowReadButton(false);
        setPrivateKey(null);
        setKeyStatus(null);
    }

    async function CommonLinkSet(linkUrl: string) {
        try {
            const id = extractLinkId(linkUrl);
            if (!id) {
                setLinkId(null);
                return;
            }

            setLinkId(id);
            await loadStoredPrivateKey(id);
            await fetchMessages(id);
        } catch {
            setLinkId(null);
        }
    }

    async function handleCreate() {
        setLoading(true);
        try {
            const keyPair = await generateRecipientKeyPair();
            const publicKey = await exportPublicKey(keyPair.publicKey);
            const serializedPrivateKey = await exportPrivateKey(keyPair.privateKey);

            const res = await fetch(appApiPath("/ask/create"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ oneTimeRead, publicKey }),
            });

            const data = await res.json();
            if (!res.ok) {
                setKeyStatus(data?.error === "public-key-required" ? "Private key generation failed." : "Could not create link.");
                return;
            }

            setUrl(data.url ?? null);
            if (typeof data.oneTimeRead === "boolean") {
                setOneTimeRead(data.oneTimeRead);
            }

            if (data.url) {
                const createdLinkId = extractLinkId(data.url);
                setLinkId(createdLinkId);
                setPrivateKey(keyPair.privateKey);

                if (persistPrivateKey && createdLinkId) {
                    window.localStorage.setItem(storageKey(createdLinkId), serializedPrivateKey);
                    setKeyStatus("Private key saved in local storage for this device.");
                } else {
                    setKeyStatus("Private key kept only in this tab.");
                }

                await CommonLinkSet(data.url);
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!rawMessages.length) {
            setMessages([]);
            return;
        }

        let cancelled = false;

        async function decryptMessages() {
            if (!privateKey) {
                setMessages([]);
                if (linkId) {
                    setKeyStatus("Private key is not loaded, so messages cannot be decrypted.");
                }
                return;
            }

            const decrypted = await Promise.all(
                rawMessages.map(async (message) => {
                    if (!message.encryptedKey || !message.iv) {
                        return {
                            id: message.id,
                            content: message.content,
                            createdAt: message.createdAt,
                        };
                    }

                    const content = await decryptTextFromRecipient(privateKey, {
                        content: message.content,
                        encryptedKey: message.encryptedKey,
                        iv: message.iv,
                    });

                    return {
                        id: message.id,
                        content,
                        createdAt: message.createdAt,
                    };
                }),
            );

            if (!cancelled) {
                setMessages(decrypted);
            }
        }

        decryptMessages().catch(() => {
            if (!cancelled) {
                setMessages([]);
                setKeyStatus("Could not decrypt one or more messages.");
            }
        });

        return () => {
            cancelled = true;
        };
    }, [linkId, privateKey, rawMessages]);

    useEffect(() => {
        if (!linkId) return;

        if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
        }

        const es = new EventSource(appApiPath(`/s/${encodeURIComponent(linkId)}/stream`));
        esRef.current = es;

        es.addEventListener("init", (ev: MessageEvent) => {
            try {
                const data = JSON.parse(ev.data);
                setRawMessages(Array.isArray(data) ? (data as RawMessage[]) : []);
            } catch {
                setRawMessages([]);
            }
        });

        es.addEventListener("message", async () => {
            try {
                await fetchMessages();
            } catch {
                // ignore stream refresh errors
            }
        });

        es.onerror = () => {
            try {
                es.close();
            } catch {
                // ignore close errors
            }
            esRef.current = null;
        };

        return () => {
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }
        };
    }, [linkId]);

    useEffect(() => {
        async function checkExistingLink() {
            setLoading(true);
            try {
                const res = await fetch(appApiPath("/ask/create"), {
                    method: "GET",
                });

                if (!res.ok) return;

                const data = await res.json();
                if (!data.url) return;

                setUrl(data.url ?? null);
                if (typeof data.oneTimeRead === "boolean") {
                    setOneTimeRead(data.oneTimeRead);
                }

                await CommonLinkSet(data.url);
            } finally {
                setLoading(false);
            }
        }

        checkExistingLink();
    }, []);

    return (
        <div className="p-8">
            <h1 className="text-2xl mb-4">Create a private message link</h1>
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-medium text-gray-900">End-to-end encrypted by design</p>
                <p className="mt-1">
                    This link uses the browser&apos;s Web Crypto API with hybrid encryption:
                    RSA-OAEP wraps a per-message AES-GCM key, and AES-GCM encrypts the
                    actual message. The server only stores ciphertext and the wrapped key.
                </p>
                <p className="mt-2 text-gray-600">
                    You can optionally persist the private key in local storage on this
                    device. That is convenient, but less secure than keeping it only in
                    the current tab.
                </p>
            </div>
            {!hasActiveLink && (
                <div className="mb-4 space-y-3">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={oneTimeRead}
                            onChange={(e) => setOneTimeRead(e.target.checked)}
                            className="h-4 w-4"
                        />
                        <span>One Time read</span>
                    </label>

                    <label className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            checked={persistPrivateKey}
                            onChange={(e) => setPersistPrivateKey(e.target.checked)}
                            className="mt-1 h-4 w-4"
                        />
                        <span className="text-sm text-gray-700">
                            Persist private key in local storage
                            <span
                                className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-400 text-[11px] text-gray-600"
                                title="This keeps the private key in the browser on this device. Only enable it if you trust the device and browser profile."
                            >
                                i
                            </span>
                        </span>
                    </label>
                    <p className="text-sm text-gray-500">
                        If you do not persist it, the private key stays in this tab only.
                    </p>
                </div>
            )}

            <div className="flex gap-2 flex-wrap">
                {!hasActiveLink && (
                    <button
                        className="px-4 py-2 bg-blue-600 text-white rounded"
                        onClick={handleCreate}
                        disabled={loading}
                    >
                        {loading ? "Working..." : "Create a new link"}
                    </button>
                )}

                {linkId && (
                    <button
                        className="px-4 py-2 bg-green-600 text-white rounded"
                        onClick={() => fetchMessages()}
                        disabled={!linkId}
                    >
                        Refresh messages
                    </button>
                )}

                {linkId && (
                    <button
                        className="px-4 py-2 bg-red-800 text-white rounded"
                        onClick={() => deleteLink()}
                    >
                        Delete link
                    </button>
                )}
            </div>

            {url !== null && (
                <div className="mt-4 space-y-2">
                    <p>Your link:</p>
                    <a className="text-blue-700 break-all" href={url} target="_blank" rel="noreferrer">
                        {url}
                    </a>
                    <p className="text-sm text-gray-600">
                        One Time read: {oneTimeRead ? "enabled" : "disabled"}
                    </p>
                    <p className="text-sm text-gray-600">
                        {keyStatus ?? "Waiting for a private key state."}
                    </p>
                </div>
            )}

            {linkId && (
                <div className="mt-6">
                    <h2 className="text-xl mb-2">Messages for this link</h2>
                    <p className="mb-3 text-sm text-gray-600">Message count: {messageCount}</p>
                    {oneTimeRead && messageCount > 0 && (
                        <button
                            className="mb-3 px-4 py-2 bg-black text-white rounded"
                            onClick={() => readOneTimeMessages()}
                        >
                            Read message{messageCount > 1 ? "s" : ""}
                        </button>
                    )}
                    {messages.length === 0 ? (
                        <p className="text-muted">
                            {oneTimeRead ? "Messages are hidden until you read them." : "No messages yet."}
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {messages.map((message) => (
                                <li key={message.id} className="p-2 border rounded">
                                    <div className="text-sm text-gray-500">
                                        {new Date(message.createdAt).toLocaleString()}
                                    </div>
                                    <div className="mt-1 whitespace-pre-wrap">{message.content}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
