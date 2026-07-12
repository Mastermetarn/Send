"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { appApiPath } from "@/lib/paths";

type StateResponse = {
  ok: boolean;
  canRead?: boolean;
};

type ReadResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  deleted?: boolean;
};

export default function GiveMessagePage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [canRead, setCanRead] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function loadState() {
    if (!id) return;

    setLoading(true);
    try {
      const res = await fetch(appApiPath(`/g/${encodeURIComponent(id)}/state`));

      if (res.status === 404) {
        setNotFound(true);
        return;
      }

      if (!res.ok) return;

      const data = (await res.json()) as StateResponse;

      setCanRead(Boolean(data.canRead));
    } finally {
      setLoading(false);
    }
  }

  async function readMessage() {
    if (!id) return;

    setStatus("reading");

    const res = await fetch(appApiPath(`/g/${encodeURIComponent(id)}/read`), {
      method: "POST",
    });

    if (res.status === 404) {
      setNotFound(true);
      setStatus(null);
      return;
    }

    const data = (await res.json()) as ReadResponse;

    if (!res.ok) {
      setStatus(data.error === "limit-reached" ? "limit-reached" : "error");
      setCanRead(false);
      return;
    }

    setMessage(data.message ?? null);
    setCanRead(false);
    if (data.deleted) {
      setStatus("read");
      return;
    }
    setStatus("read");
  }

  useEffect(() => {
    loadState();
  }, [id]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (notFound) {
    return (
      <div className="p-8">
        <h1 className="text-2xl mb-4">Link not found</h1>
        <p>This link does not exist anymore.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl mb-4">Private message</h1>

      {message ? (
        <div className="rounded border p-4 mb-4 bg-white">
          <p>{message}</p>
        </div>
      ) : null}

      {canRead ? (
        <button
          className="px-4 py-2 bg-black text-white rounded"
          onClick={readMessage}
        >
          Read message
        </button>
      ) : !message ? (
        <p className="text-red-700">Read limit reached for this link.</p>
      ) : null}

      {status === "reading" && <p className="mt-2">Reading...</p>}
      {status === "error" && <p className="mt-2 text-red-700">Could not read the message.</p>}
      {status === "limit-reached" && !message && <p className="mt-2 text-red-700">This link reached its read limit.</p>}
    </div>
  );
}
