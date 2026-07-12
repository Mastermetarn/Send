"use client";


import { useEffect, useMemo, useState } from "react";
import { appApiPath } from "@/lib/paths";

type GiveCreateResponse = {
  ok: boolean;
  url?: string | null;
    accessCount?: number;
  readCount?: number;
  remainingReads?: number;
    maxReads?: number;
};

export default function GivePage() {
const [message, setMessage] = useState("");
const [maxReadsInput, setMaxReadsInput] = useState("1");
  const [loading, setLoading] = useState(false);
const [url, setUrl] = useState<string | null>(null);
const [accessCount, setAccessCount] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [remainingReads, setRemainingReads] = useState(0);
  const [savedMaxReads, setSavedMaxReads] = useState(1);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);

const hasLink = Boolean(url);

  function extractLinkId(inputUrl: string | null | undefined) {
    if (!inputUrl) return null;
    try {
      const parsed = new URL(inputUrl);
      const parts = parsed.pathname.split("/");
      return parts[parts.length - 1] || null;
    } catch {
      return null;
    }
  }

  const fetchedLabel = useMemo(() => {
    return `${readCount} / ${savedMaxReads}`;
  }, [readCount, savedMaxReads]);

  async function loadExisting() {
    setLoading(true);
      try {
        const res = await fetch(appApiPath("/give/create"), { method: "GET" });
      if (!res.ok) return;

      const data = (await res.json()) as GiveCreateResponse;

      setUrl(data.url ?? null);
      setActiveLinkId(extractLinkId(data.url));
      setSavedMaxReads(typeof data.maxReads === "number" ? data.maxReads : 1);
      setAccessCount(typeof data.accessCount === "number" ? data.accessCount : 0);
      setReadCount(typeof data.readCount === "number" ? data.readCount : 0);
      setRemainingReads(
        typeof data.remainingReads === "number" ? data.remainingReads : 0,
      );
    } finally {
      setLoading(false);
    }
  }

  async function createLink() {
    const trimmed = message.trim();
    if (!trimmed) return;

    const parsedMaxReads = Number(maxReadsInput);
    const safeMaxReads = Number.isFinite(parsedMaxReads)
      ? Math.max(1, Math.min(100, Math.floor(parsedMaxReads)))
      : 1;

    setLoading(true);
    try {
      const res = await fetch(appApiPath("/give/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          maxReads: safeMaxReads,
        }),
      });

      if (!res.ok) return;

      const data = (await res.json()) as GiveCreateResponse;

      setUrl(data.url ?? null);
      setActiveLinkId(extractLinkId(data.url));
      setSavedMaxReads(typeof data.maxReads === "number" ? data.maxReads : 1);
      setAccessCount(typeof data.accessCount === "number" ? data.accessCount : 0);
      setReadCount(typeof data.readCount === "number" ? data.readCount : 0);
      setRemainingReads(
        typeof data.remainingReads === "number" ? data.remainingReads : 0,
      );

      setMessage("");
      setMaxReadsInput(String(safeMaxReads));
    } finally {
      setLoading(false);
    }
  }

  async function deleteLink() {
    setLoading(true);
    try {
      const res = await fetch(appApiPath("/give/delete"), { method: "POST" });
      if (!res.ok) return;

      setUrl(null);
      setActiveLinkId(null);
      setAccessCount(0);
      setReadCount(0);
      setRemainingReads(0);
      setSavedMaxReads(1);
      setMessage("");
      setMaxReadsInput("1");
      } finally {
        setLoading(false);
        }
    }

    useEffect(() => {
    loadExisting();
    }, []);

    useEffect(() => {
        if (!activeLinkId) return;

    const source = new EventSource(appApiPath(`/give/${encodeURIComponent(activeLinkId)}/stream`));

    source.onmessage = (event) => {
        try {
            const stats = JSON.parse(event.data) as {
          accessCount?: number;
          readCount?: number;
          maxReads?: number;
          remainingReads?: number;
        };

        setAccessCount(typeof stats.accessCount === "number" ? stats.accessCount : 0);
        setReadCount(typeof stats.readCount === "number" ? stats.readCount : 0);
        setSavedMaxReads(typeof stats.maxReads === "number" ? stats.maxReads : 1);
        setRemainingReads(
          typeof stats.remainingReads === "number" ? stats.remainingReads : 0,
        );
      } catch {
        // ignore malformed SSE payloads
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
        source.close();
    };
  }, [activeLinkId]);

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Give a private message</h1>

      {!hasLink && (
        <div className="space-y-3 max-w-xl">
          <label className="block">
            <span className="block mb-1 text-sm text-gray-700">Message</span>
            <textarea
              className="w-full min-h-28 p-2 border rounded"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the message you want behind the link..."
            />
          </label>

          <label className="block">
            <span className="block mb-1 text-sm text-gray-700">Max link accesses</span>
            <input
              type="number"
              min={1}
              max={100}
              value={maxReadsInput}
              onChange={(e) => {
                setMaxReadsInput(e.target.value);
              }}
              className="w-32 p-2 border rounded"
            />
          </label>

          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={createLink}
            disabled={loading || !message.trim()}
          >
            {loading ? "Working..." : "Generate link"}
          </button>
        </div>
      )}

      {hasLink && (
        <div className="space-y-3">
          <div>
            <p>Your link:</p>
            <a className="text-blue-700 break-all" href={url!} target="_blank" rel="noreferrer">
              {url}
            </a>
          </div>

          <div className="rounded border p-3 max-w-xl">
            <p>Page accesses: {accessCount}</p>
            <p>Message fetched: {fetchedLabel}</p>
            <p>Remaining reads: {remainingReads}</p>
          </div>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-green-700 text-white rounded"
              onClick={loadExisting}
              disabled={loading}
            >
              Refresh stats
            </button>

            <button
              className="px-4 py-2 bg-red-800 text-white rounded"
              onClick={deleteLink}
              disabled={loading}
            >
              Delete link and message
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
  // import { useEffect, useRef, useState } from "react";

// type Stats = {
//   accessCount: number;
//   readCount: number;
//   remainingReads: number;
//   maxReads?: number;
// };

// export default function GiveOwnerPage() {
//   const [message, setMessage] = useState("");
//   const [maxReads, setMaxReads] = useState("1");
//   const [url, setUrl] = useState<string | null>(null);
//   const [stats, setStats] = useState<Stats | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [status, setStatus] = useState<string | null>(null);

//   const esRef = useRef<EventSource | null>(null);

//   useEffect(() => {
//     let mounted = true;

//     async function load() {
//       setLoading(true);
//       try {
//         const res = await fetch(`/api/give/create`);
//         const data = await res.json();
//         if (!mounted) return;
//         if (data?.url) {
//           setUrl(data.url);
//           setStats({
//             accessCount: data.accessCount ?? 0,
//             readCount: data.readCount ?? 0,
//             remainingReads: data.remainingReads ?? 0,
//             maxReads: data.maxReads ?? undefined,
//           });
//           setMaxReads(String(data.maxReads ?? 1));
//         }
//       } catch (e) {
//         // ignore
//       } finally {
//         if (mounted) setLoading(false);
//       }
//     }

//     load();
//     return () => {
//       mounted = false;
//     };
//   }, []);

//   useEffect(() => {
//     // subscribe to SSE when we have a url
//     if (!url) return;
//     const id = url.split("/").pop();
//     if (!id) return;

//     const es = new EventSource(`/api/give/${encodeURIComponent(id)}/stream`);
//     esRef.current = es;

//     es.addEventListener("message", (ev) => {
//       try {
//         const d = JSON.parse((ev as MessageEvent).data);
//         setStats(d as Stats);
//       } catch (e) {
//         // ignore
//       }
//     });

//     es.addEventListener("error", () => {
//       // If connection dies, close and clear ref
//       es.close();
//       esRef.current = null;
//     });

//     return () => {
//       es.close();
//       esRef.current = null;
//     };
//   }, [url]);

//   async function handleCreate() {
//     setStatus("creating");
//     const parsed = Number(maxReads ?? 1);
//     const max = Number.isFinite(parsed)
//       ? Math.max(1, Math.min(100, Math.floor(parsed)))
//       : 1;

//     const res = await fetch(`/api/give/create`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ message, maxReads: max }),
//     });

//     if (!res.ok) {
//       const data = await res.json().catch(() => ({} as any));
//       setStatus(data?.error ?? "error");
//       return;
//     }

//     const data = await res.json();
//     setUrl(data.url ?? null);
//     setStats({
//       accessCount: data.accessCount ?? 0,
//       readCount: data.readCount ?? 0,
//       remainingReads: data.remainingReads ?? 0,
//       maxReads: data.maxReads ?? max,
//     });
//     setMaxReads(String(data.maxReads ?? max));
//     setStatus("created");
//   }

//   async function handleDelete() {
//     setStatus("deleting");
//     const res = await fetch(`/api/give/delete`, { method: "POST" });
//     if (!res.ok) {
//       setStatus("error");
//       return;
//     }
//     // tear down
//     setUrl(null);
//     setStats(null);
//     setStatus("deleted");
//     if (esRef.current) {
//       esRef.current.close();
//       esRef.current = null;
//     }
//   }

//   return (
//     <div className="p-8">
//       <h1 className="text-2xl mb-4">Give a message</h1>

//       {loading ? (
//         <div>Loading...</div>
//       ) : url ? (
//         <div>
//           <p className="mb-2">Your link: <a className="text-blue-600" href={url}>{url}</a></p>
//           {stats && (
//             <div className="mb-4">
//               <div>Max reads: {stats.maxReads ?? "?"}</div>
//               <div>Accesses: {stats.accessCount}</div>
//               <div>Reads: {stats.readCount}</div>
//               <div>Remaining reads: {stats.remainingReads}</div>
//             </div>
//           )}

//           <button onClick={handleDelete} className="px-3 py-1 bg-red-600 text-white rounded">
//             Delete link
//           </button>
//         </div>
//       ) : (
//         <div>
//           <textarea
//             value={message}
//             onChange={(e) => setMessage(e.target.value)}
//             className="w-full h-32 p-2 border mb-2"
//             placeholder="Message to give"
//           />

//           <div className="mb-2">
//             <label className="mr-2">Max reads:</label>
//             <input
//               value={maxReads}
//               onChange={(e) => setMaxReads(e.target.value)}
//               className="border px-2 py-1 w-24"
//             />
//           </div>

//           <button onClick={handleCreate} className="px-4 py-2 bg-green-600 text-white rounded">
//             Create link
//           </button>

//           {status && <p className="mt-2">Status: {status}</p>}
//         </div>
//       )}
//     </div>
//   );
// }
