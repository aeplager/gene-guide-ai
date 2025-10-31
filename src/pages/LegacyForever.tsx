import { useEffect, useRef, useState } from "react";

type DailyCallFrame = any;

const LegacyForever = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const callFrameRef = useRef<DailyCallFrame | null>(null);
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const log = (label: string, payload?: unknown) => {
    const line = `[${new Date().toISOString()}] ${label}` +
      (payload ? `: ${JSON.stringify(payload, null, 2)}` : "");
    setTranscriptLines(prev => [...prev, line]);
  };

  useEffect(() => {
    // Load Daily JS via CDN once
    if ((window as any).DailyIframe) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@daily-co/daily-js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => log("daily:script:error");
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    // Fetch a Tavus conversation URL
    const abort = new AbortController();
    fetch("/tavus/start", { signal: abort.signal })
      .then(r => r.json())
      .then(data => {
        log("tavus:start:response", data);
        if (data?.conversation_url) {
          setConversationUrl(data.conversation_url as string);
        } else {
          log("tavus:start:error", { message: "Missing conversation_url in response" });
        }
      })
      .catch(err => log("tavus:start:fetch:error", { message: err?.message || String(err) }));
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !conversationUrl || !containerRef.current) return;
    const DailyIframe = (window as any).DailyIframe;
    if (!DailyIframe) return;

    const frame: DailyCallFrame = DailyIframe.createFrame(
      containerRef.current,
      { iframeStyle: { width: "100%", height: "600px", border: "0" } }
    );
    callFrameRef.current = frame;

    const events = [
      "loaded",
      "joined-meeting",
      "left-meeting",
      "error",
      "participant-joined",
      "participant-left",
      "network-quality-change",
    ];
    events.forEach(evt => frame.on(evt as any, (e: unknown) => log(`daily:${evt}`, e)));

    frame.join({ url: conversationUrl })
      .then(() => log("daily:join:success"))
      .catch((err: any) => log("daily:join:error", { message: err?.message || String(err) }));

    return () => {
      try {
        frame.leave?.();
        frame.destroy?.();
      } catch {
        // ignore cleanup errors
      }
      callFrameRef.current = null;
    };
  }, [scriptLoaded, conversationUrl]);

  return (
    <div className="min-h-screen bg-gradient-bg p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold text-foreground">Legacy Forever</h1>
          <p className="text-muted-foreground">Connecting to your Tavus video conversation…</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="shadow-professional rounded-lg overflow-hidden">
              <div ref={containerRef} style={{ width: "100%", height: 600 }} />
            </div>
          </div>
          <div>
            <div className="shadow-card rounded-lg p-4 bg-background border">
              <h2 className="font-medium mb-2">Events & Transcript</h2>
              <div className="h-[200px] overflow-y-auto text-xs whitespace-pre-wrap border rounded p-2 bg-muted/20">
                {transcriptLines.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegacyForever;


