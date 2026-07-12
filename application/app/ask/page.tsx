"use client";

import React, { useEffect, useRef, useState } from "react";
import { appApiPath } from "@/lib/paths";

type Message = { id: number; content: string; createdAt: number };

export default function CreatePage() {
    const [url, setUrl] = useState<string | null>(null);
    const [linkId, setLinkId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [oneTimeRead, setOneTimeRead] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageCount, setMessageCount] = useState<number>(0);
    const [showReadButton, setShowReadButton] = useState(false);
    const [debugLines, setDebugLines] = useState<string[]>([]);
    const esRef = useRef<EventSource | null>(null);
    const hasActiveLink = url !== null;

    async function handleCreate() {
        setLoading(true);
        try {
            const res = await fetch(appApiPath("/ask/create"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ oneTimeRead }),
            });
            const data = await res.json();
            console.log("Create response data:", data, data.url);
            setUrl(data.url ?? null);

            if (data.url) {
                if (typeof data.oneTimeRead === "boolean") {
                    setOneTimeRead(data.oneTimeRead);
                }
                await CommonLinkSet(data.url, typeof data.oneTimeRead === "boolean" ? data.oneTimeRead : oneTimeRead);
            }
        } finally {
            setLoading(false);
        }
    }

    async function fetchMessages(id?: string) {
        const targetId = id ?? linkId;
        if (!targetId) return;

        const res = await fetch(appApiPath(`/s/${targetId}/messages`));
        if (!res.ok) return;

        const data = await res.json();
        if (data.oneTimeRead) {
            const count = typeof data.messageCount === "number" ? data.messageCount : 0;
            setMessageCount(count);
            setShowReadButton(count > 0);
            return count;
        }

        setMessages(data.messages ?? []);
        setMessageCount(typeof data.messageCount === "number" ? data.messageCount : (data.messages ?? []).length);
        setShowReadButton(Boolean(data.oneTimeRead) && (typeof data.messageCount === "number" ? data.messageCount : 0) > 0);
        return data.messageCount;
    }

    async function readOneTimeMessages(id?: string) {
        const targetId = id ?? linkId;
        if (!targetId) return;

        const res = await fetch(appApiPath(`/s/${targetId}/messages`), {
            method: "POST",
        });

        if (!res.ok) return;

        const data = await res.json();
        setMessages((prev) => [...prev, ...(data.messages ?? [])]);
        setMessageCount(typeof data.messageCount === "number" ? data.messageCount : (data.messages ?? []).length);
        setShowReadButton(false);
    }

    async function DeleteLink() {
        console.log("Attempting to delete link with id=", linkId);
        const res = await fetch(appApiPath("/ask/delete"), { method: "POST" });
        if (!res.ok) return;

        // await CommonLinkSet("");
        setLinkId(null);
        setUrl(null);
        setOneTimeRead(false);
        setMessages([]);
        setMessageCount(0);
        setShowReadButton(false);
    }

    async function CommonLinkSet(url: string, isOneTimeRead = oneTimeRead) {
        try {
            const u = new URL(url);
            const parts = u.pathname.split("/");
            const id = parts[parts.length - 1];
            setLinkId(id);
            await fetchMessages(id);
        } catch {
            setLinkId(null);
        }
    }

    useEffect(() => {
        // Automatically open SSE when a link is created; close on cleanup or when linkId changes
        if (!linkId) return;


        // close existing if any
        if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
        }

        const es = new EventSource(appApiPath(`/s/${encodeURIComponent(linkId)}/stream`));
        esRef.current = es;

        // es.onopen = () => {
        // };

        es.addEventListener("init", (ev: MessageEvent) => {
            try {
                const data = JSON.parse(ev.data);
                setMessages(Array.isArray(data) ? data : []);
            } catch (e) {
            }
        });

        es.addEventListener("message", async (ev: MessageEvent) => {
            try {
                // const msg = JSON.parse(ev.data);
                // setMessages((prev) => [...prev, msg]);
                await fetchMessages();
            } catch (e) {
            }
        });

        es.onerror = () => {
            try {
                es.close();
            } catch (e) { }
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

                console.log("Existing link data:", data, data.url);
                if (!data.url) return; // nothing exists → do NOT create
                console.log("Existing link found:", data.url);
                setUrl(data.url ?? null);
                if (typeof data.oneTimeRead === "boolean") {
                    setOneTimeRead(data.oneTimeRead);
                }

                if (data.url) {
                    CommonLinkSet(data.url, typeof data.oneTimeRead === "boolean" ? data.oneTimeRead : false);
                }
            }
            finally {
                setLoading(false);
            }
        }

        checkExistingLink();
    }, []);

    return (
        <div className="p-8">
            <h1 className="text-2xl mb-4">Create a private message link</h1>
            {!hasActiveLink && (
                <label className="mb-4 flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={oneTimeRead}
                        onChange={(e) => setOneTimeRead(e.target.checked)}
                        className="h-4 w-4"
                    />
                    <span>One Time read</span>
                </label>
            )}
            <div className="flex gap-2">
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
                        onClick={() => DeleteLink()}
                    >
                        Delete link
                    </button>
                )}
            </div>

            {url !== null && (
                <div className="mt-4">
                    <p>Your link:</p>
                    <a key={url} className="text-blue-700 break-all" href={url} target="_blank" rel="noreferrer">
                        {url}
                    </a>
                    <p className="mt-2 text-sm text-gray-600">
                        One Time read: {oneTimeRead ? "enabled" : "disabled"}
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
                        <p className="text-muted">{oneTimeRead ? "Messages are hidden until you read them." : "No messages yet."}</p>
                    ) : (
                        <ul className="space-y-2">
                            {messages.map((m) => (
                                <li key={m.id} className="p-2 border rounded">
                                    <div className="text-sm text-gray-500">{new Date(m.createdAt).toLocaleString()}</div>
                                    <div className="mt-1">{m.content}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* <div className="mt-8 rounded border p-4"> */}
            {/* <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">SSE debug</h2> */}
            {/* <pre className="mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap"> */}
            {/* {debugLines.join("\n") || "No SSE debug events yet."} */}
            {/* </pre> */}
            {/* </div> */}
        </div>
    );
}
