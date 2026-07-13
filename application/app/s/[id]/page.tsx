"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { appApiPath } from "@/lib/paths";
import { encryptTextForRecipient, importPublicKey } from "@/lib/e2ee";

export default function SessionPage() {
    const params = useParams();
    const id = params?.id as string;

    const [content, setContent] = useState("");
    const [status, setStatus] = useState<string | null>(null);
    const [validLink, setValidLink] = useState<boolean | null>(null);
    const [publicKey, setPublicKey] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        async function checkLink() {
            const res = await fetch(appApiPath(`/s/${encodeURIComponent(id)}/exists`));
            const data = await res.json();
            setValidLink(data.exists);
            setPublicKey(data.publicKey ?? null);
        }

        checkLink();
    }, [id]);

    async function send() {
        if (!id) {
            setStatus("no-id");
            return;
        }

        setStatus("sending");

        if (!publicKey) {
            setStatus("missing-public-key");
            return;
        }

        const recipientKey = await importPublicKey(publicKey);
        const encryptedPayload = await encryptTextForRecipient(recipientKey, content);

        const res = await fetch(appApiPath(`/s/${encodeURIComponent(id)}/message`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(encryptedPayload),
        });

        if (res.status === 404) {
            const data = await res.json().catch(() => ({} as any));
            if (data?.error === "not-found") {
                setStatus("link-deleted");
                setValidLink(false);
                return;
            }
        }

        setStatus(res.ok ? "sent" : "error");
        setContent("");
    }

    if (validLink === null) {
        return <div className="p-8">Loading...</div>;
    }

    if (!validLink) {
        return (
            <div className="p-8">
                <h1 className="text-2xl mb-4">Link not found</h1>
                <p>The link you are trying to access does not exist.</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl mb-4">Send a message to this link</h1>
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-medium text-gray-900">End-to-end encrypted before upload</p>
                <p className="mt-1">
                    Your message is encrypted in the browser with the link&apos;s public key
                    using the Web Crypto API. This project uses hybrid encryption:
                    AES-GCM encrypts the message and RSA-OAEP encrypts the AES key.
                </p>
                <p className="mt-2 text-gray-600">
                    The server receives only encrypted data, and only the link creator can decrypt the message.
                </p>
            </div>

            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-24 p-2 border"
            />

            {publicKey === null && validLink && (
                <p className="mt-2 text-sm text-gray-600">
                    Waiting for the link public key.
                </p>
            )}

            <button
                onClick={send}
                className="px-4 py-2 bg-green-600 text-white rounded mt-2"
                disabled={!validLink || !publicKey}
            >
                Send
            </button>

            {status === "link-deleted" ? (
                <p className="mt-2 text-red-600">Link no longer exists.</p>
            ) : (
                status && <p className="mt-2">Status: {status}</p>
            )}
        </div>
    );
}