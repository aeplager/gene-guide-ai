import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  MessageCircle, 
  Send, 
  Video, 
  Bot,
  Download,
  Share,
  AlertTriangle,
  Sparkles,
  PhoneOff,
  ThumbsUp,
  ThumbsDown,
  Save,
  FileText
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useWarmLLM } from "@/hooks/useWarmLLM";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  type: "text" | "audio" | "video";
}

const QAScreen = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<any>(null);
  const { toast } = useToast();

  // State for conversation continuation
  const [startNewConversation, setStartNewConversation] = useState(false);
  const [existingConversationId, setExistingConversationId] = useState<string | null>(null);
  const [existingConversationDate, setExistingConversationDate] = useState<string | null>(null);

  const backendBase = import.meta.env.DEV ? '' : (import.meta.env.VITE_TAVUS_BACKEND_URL || '');
  
  // Pre-warm the LLM when user enters this screen
  useWarmLLM();

  // State for live transcript
  const [transcript, setTranscript] = useState<Array<{
    conversation_id: number | string;
    ordinal: number;
    role: string;
    content: string | { text?: string; topic_id?: string; [key: string]: any };
    created_at: string;
    feedback_status: number;
    feedback: string | null;
  }>>([]);
  
  // State for feedback management (key is "conversationId-ordinal")
  const [feedbackChanges, setFeedbackChanges] = useState<Record<string, { status: number; text: string; conversation_id: number | string; ordinal: number }>>({});
  const [savingFeedback, setSavingFeedback] = useState(false);
  const transcriptPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State for source documentation viewer
  const [sourceDocOpen, setSourceDocOpen] = useState(false);
  const [sourceDocData, setSourceDocData] = useState<{
    gene: string;
    mutation: string;
    classification: string;
    source_document: string;
    source_url: string;
    source_retrieved_at: string | null;
  } | null>(null);
  const [loadingSourceDoc, setLoadingSourceDoc] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch most recent conversation ID on page load
  useEffect(() => {
    const fetchRecentConversation = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        console.log("[Conversation] No auth token, skipping fetch");
        return;
      }

      try {
        const response = await fetch(`${backendBase}/tavus/conversation-id/recent`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.found && data.conversation_id) {
            setExistingConversationId(data.conversation_id);
            setExistingConversationDate(data.created_at);
            console.log(`[Conversation] Found existing conversation: ${data.conversation_id} (${data.created_at})`);
          } else {
            console.log("[Conversation] No previous conversation found");
          }
        } else {
          console.error("[Conversation] Error fetching:", response.status);
        }
      } catch (error) {
        console.error("[Conversation] Fetch error:", error);
      }
    };

    fetchRecentConversation();
  }, [backendBase]);

  // Start polling for transcript immediately on page load
  // Logic:
  // - Before video call starts: Show specific previous conversation (if exists)
  // - After video call starts: Show all recent conversations (to capture both previous and active)
  useEffect(() => {
    const getConversationId = () => {
      // If video call is active, always fetch recent (to capture all conversations)
      if (isVideoCall) {
        console.log(`[Transcript] 🎯 getConversationId: Video active, fetching recent (all conversations)`);
        return undefined;
      }
      
      // If no video call but we have an existing conversation to show, fetch that one
      if (existingConversationId && !startNewConversation) {
        console.log(`[Transcript] 🎯 getConversationId: Using existing conversation ${existingConversationId}`);
        return existingConversationId;
      }
      
      console.log(`[Transcript] 🎯 getConversationId: Fetching recent conversations (existingId: ${existingConversationId}, startNew: ${startNewConversation})`);
      return undefined;
    };

    console.log("[Transcript] 🔄 Starting polling (or restarting due to dependency change)...");
    console.log(`[Transcript] 🔄 Dependencies: existingConversationId=${existingConversationId}, startNewConversation=${startNewConversation}, isVideoCall=${isVideoCall}`);
    
    const convId = getConversationId();
    if (convId) {
      console.log(`[Transcript] ✅ Will poll specific conversation: ${convId}`);
    } else {
      console.log("[Transcript] ✅ Will poll recent conversations (2h)");
    }
    
    // Fetch immediately
    fetchTranscript(convId);
    
    // Clear any existing interval before creating a new one
    if (transcriptPollIntervalRef.current) {
      console.log("[Transcript] 🧹 Clearing existing polling interval");
      clearInterval(transcriptPollIntervalRef.current);
    }
    
    // Poll every 3 seconds
    transcriptPollIntervalRef.current = setInterval(() => {
      fetchTranscript(getConversationId());
    }, 3000);
    
    console.log("[Transcript] ⏰ Polling interval started (every 3 seconds)");
    
    // Cleanup when effect re-runs or component unmounts
    return () => {
      if (transcriptPollIntervalRef.current) {
        console.log("[Transcript] 🧹 Cleanup: Clearing polling interval");
        clearInterval(transcriptPollIntervalRef.current);
      }
    };
  }, [existingConversationId, startNewConversation, isVideoCall]); // Re-run when these change

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: "user",
      timestamp: new Date(),
      type: "text"
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: generateAIResponse(inputMessage),
        sender: "ai",
        timestamp: new Date(),
        type: "text"
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const generateAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes("risk") || input.includes("chance")) {
      return "Based on your BRCA1 pathogenic variant, you have a significantly increased risk of breast cancer (60-80% lifetime risk) and ovarian cancer (20-40% lifetime risk). However, having this genetic variant doesn't mean you will definitely develop cancer. Many factors influence cancer development, and there are effective preventive measures we can discuss.";
    }
    
    if (input.includes("family") || input.includes("children") || input.includes("inherit")) {
      return "Since this is an inherited genetic variant, there's a 50% chance you could pass it on to each of your children. Family members (parents, siblings, children) may also want to consider genetic testing. I'd recommend discussing genetic counseling with your family members so they can make informed decisions about testing.";
    }
    
    if (input.includes("prevent") || input.includes("screening") || input.includes("treatment")) {
      return "There are several proven strategies to manage your increased risk: 1) Enhanced screening starting at age 25 (MRI and mammography), 2) Preventive surgeries (mastectomy/oophorectomy) which significantly reduce risk, 3) Medications like tamoxifen for risk reduction, and 4) Lifestyle modifications. The best approach depends on your personal situation, age, and family planning goals.";
    }
    
    if (input.includes("scared") || input.includes("worried") || input.includes("afraid")) {
      return "It's completely normal to feel scared or worried after receiving these results. Many people feel overwhelmed initially. Remember that knowledge is power - knowing about this genetic variant gives you the opportunity to take proactive steps. You're not alone in this journey, and there are excellent support resources and medical teams to help guide you.";
    }
    
    return "That's a great question. Based on your BRCA1 results, I can provide you with evidence-based information to help you understand your situation better. Would you like me to explain any specific aspect in more detail? I'm here to help you process this information at your own pace.";
  };

  // Fetch transcript from backend
  const fetchTranscript = async (conversationId?: string) => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      console.log("[Transcript] ⚠️ No auth token, skipping fetch");
      return;
    }

    try {
      // Build URL with optional conversation_id parameter
      let url = `${backendBase}/conversations/recent-transcript`;
      if (conversationId) {
        url += `?conversation_id=${encodeURIComponent(conversationId)}`;
        console.log(`[Transcript] 📡 Fetching specific conversation: ${conversationId}`);
        console.log(`[Transcript] 📡 Request URL: ${url}`);
      } else {
        console.log(`[Transcript] 📡 Fetching recent conversations (2h)`);
        console.log(`[Transcript] 📡 Request URL: ${url}`);
      }

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      console.log(`[Transcript] 📥 Response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[Transcript] 📥 Response data:`, data);
        setTranscript(data.turns || []);
        console.log(`[Transcript] ✅ Fetched ${data.count || 0} turns${conversationId ? ' for conversation ' + conversationId : ''}`);
        
        if (data.count === 0 && conversationId) {
          console.warn(`[Transcript] ⚠️ No turns found for conversation ${conversationId} - conversation may not exist or have no turns yet`);
        }
      } else {
        const errorText = await response.text();
        console.error(`[Transcript] ❌ Error ${response.status}:`, errorText);
      }
    } catch (error) {
      console.error("[Transcript] ❌ Fetch error:", error);
    }
  };

  // Handle feedback changes
  const handleFeedbackStatus = (conversationId: number | string, ordinal: number, status: number) => {
    const key = `${conversationId}-${ordinal}`;
    setFeedbackChanges(prev => ({
      ...prev,
      [key]: {
        status,
        text: prev[key]?.text || '',
        conversation_id: conversationId,
        ordinal: ordinal
      }
    }));
  };

  const handleFeedbackText = (conversationId: number | string, ordinal: number, text: string) => {
    const key = `${conversationId}-${ordinal}`;
    setFeedbackChanges(prev => ({
      ...prev,
      [key]: {
        status: prev[key]?.status || 0,
        text,
        conversation_id: conversationId,
        ordinal: ordinal
      }
    }));
  };

  // Save all feedback changes
  const saveFeedback = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
      return;
    }

    setSavingFeedback(true);
    console.log("[Feedback] Starting save process for", Object.keys(feedbackChanges).length, "items");
    
    try {
      // Save each feedback change and check for success
      const results = await Promise.all(
        Object.values(feedbackChanges).map(async (feedback) => {
          console.log(`[Feedback] 📡 Sending turn ${feedback.conversation_id}-${feedback.ordinal}:`, feedback);
          const response = await fetch(`${backendBase}/conversations/turn-feedback`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversation_id: feedback.conversation_id,
              ordinal: feedback.ordinal,
              feedback_status: feedback.status,
              feedback: feedback.text,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Feedback] ❌ Server rejected turn ${feedback.conversation_id}-${feedback.ordinal}:`, errorText);
            throw new Error(`Failed to save: ${errorText}`);
          }
          return response.json();
        })
      );

      console.log("[Feedback] ✅ All items saved successfully:", results);
      
      // Clear changes only on success
      setFeedbackChanges({});
      
      // Refresh with current view context (maintain existing conversation if viewing one)
      const currentConvId = existingConversationId && !startNewConversation && !isVideoCall ? existingConversationId : undefined;
      await fetchTranscript(currentConvId);
      
      toast({ 
        title: "Feedback Saved", 
        description: `${results.length} feedback(s) saved successfully` 
      });
    } catch (error: any) {
      console.error("[Feedback] ❌ Save error:", error);
      toast({ 
        title: "Error Saving Feedback", 
        description: error.message || "Please check console for details", 
        variant: "destructive" 
      });
    } finally {
      setSavingFeedback(false);
    }
  };

  const startVideoCall = async () => {
    setIsConnecting(true);
    try {
      console.log('[qa] starting conversation', { backendBase });
      
      // Get JWT token from localStorage
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('[qa] sending with JWT token');
      }
      
      // Determine if we should continue an existing conversation
      const continueConversationId = !startNewConversation && existingConversationId ? existingConversationId : null;
      
      // Build URL with optional conversation continuation
      let url = `${backendBase}/tavus/start`;
      if (continueConversationId) {
        url += `?continue_conversation_id=${encodeURIComponent(continueConversationId)}`;
        console.log(`[qa] Continuing conversation: ${continueConversationId}`);
      } else {
        console.log('[qa] Starting new conversation');
      }
      
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error('Failed to start conversation');
      const data = await resp.json();
      console.log('[qa] tavus:start response', data);
      
      // Log debug info from backend
      if (data.debug) {
        console.log('[qa] backend debug info:', data.debug);
      }
      
      const convUrl: string | undefined = data?.conversation_url;
      const convId: string | null = data?.conversation_id || (convUrl ? String(convUrl).split('/').pop() : null);
      if (!convUrl || !convId || !containerRef.current) throw new Error('Missing conversation data or container');

      const DailyIframe = (window as any).DailyIframe;
      if (!DailyIframe) {
        console.error('[qa] ERROR: DailyIframe not available on window');
        throw new Error('Daily JS not loaded');
      }
      console.log('[qa] DailyIframe available, creating frame...');

      if (!containerRef.current) {
        console.error('[qa] ERROR: containerRef.current is null');
        throw new Error('Container ref not available');
      }
      console.log('[qa] Container ref available:', containerRef.current);

      const frame = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: '0',
          borderRadius: '8px'
        }
        // Note: 'allow' property removed - not supported by Daily.co JS API
        // Permissions are handled by browser automatically
      });
      
      frameRef.current = frame;
      console.log('[qa] Frame created:', frame);
      
      // Event listeners for debugging - more comprehensive
      const events = [
        'loading', 'loaded', 'started-camera', 'camera-error',
        'joining-meeting', 'joined-meeting', 'left-meeting', 
        'error', 'participant-joined', 'participant-left',
        'participant-updated', 'track-started', 'track-stopped'
      ];
      events.forEach((evt) => frame.on(evt as any, (e: any) => {
        console.log(`[qa] 📹 daily:${evt}`, e);
      }));
      
      console.log('[qa] Event listeners attached, joining Daily call...');
      console.log('[qa] Conversation URL:', convUrl);
      console.log('[qa] Conversation ID:', convId);
      
      // CRITICAL FIX: Show container BEFORE joining
      // Daily.co needs visible iframe to complete join
      console.log('[qa] 🎬 Making container visible before join...');
      setConversationId(convId);
      setIsVideoCall(true);
      
      // Match working app: 1500ms warmup before join
      console.log('[qa] Waiting 1500ms before joining...');
      await new Promise((r) => setTimeout(r, 1500));
      
      console.log('[qa] Calling frame.join()...');
      console.log('[qa] Join URL:', convUrl);
      
      // Add timeout to detect if join is hanging
      const joinPromise = frame.join({ url: convUrl });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Join timeout after 30 seconds')), 30000)
      );
      
      try {
        await Promise.race([joinPromise, timeoutPromise]);
        console.log('[qa] ✅ frame.join() completed successfully');
        toast({ title: 'Video call started', description: 'Connected to AI genetics counselor' });
        
        // Note: Transcript polling already running from page load
        console.log("[Transcript] Video call started, transcript will continue updating");
      } catch (joinError) {
        console.error('[qa] ❌ frame.join() failed or timed out:', joinError);
        throw joinError;
      }
    } catch (error) {
      // Enhanced error logging
      console.error('[qa] ❌ START ERROR - Full details below:');
      console.error('[qa] Error object:', error);
      console.error('[qa] Error type:', typeof error);
      console.error('[qa] Error constructor:', error?.constructor?.name);
      
      // Extract error message
      let errorMessage = 'Unable to start video call';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('[qa] Error message:', error.message);
        console.error('[qa] Error stack:', error.stack);
      } else {
        errorMessage = String(error);
        console.error('[qa] Error string:', String(error));
      }
      
      // Show detailed error to user
      toast({ 
        title: 'Video Connection Failed', 
        description: `${errorMessage}. Check browser console (F12) for details.`,
        variant: 'destructive',
        duration: 10000 // Show for 10 seconds so user can read it
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const endVideoCall = async () => {
    // Keep transcript polling running to show conversation history
    console.log("[Transcript] Video ended, but transcript will continue showing");
    
    try {
      if (conversationId) {
        console.log('[qa] ending conversation', conversationId);
        
        // Get JWT token from localStorage
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const r = await fetch(`${backendBase}/tavus/end/${conversationId}`, { 
          method: 'POST',
          headers 
        });
        console.log('[qa] tavus:end response ok?', r.ok, 'status', r.status);
      }
    } catch {}
    try {
      await frameRef.current?.leave?.();
      frameRef.current?.destroy?.();
    } catch {}
    frameRef.current = null;
    setIsVideoCall(false);
    setConversationId(null);
    toast({ title: 'Video call ended', description: 'Conversation ended' });
  };

  useEffect(() => {
    return () => {
      // Cleanup transcript polling
      if (transcriptPollIntervalRef.current) {
        clearInterval(transcriptPollIntervalRef.current);
      }
      // Cleanup video frame
      try {
        frameRef.current?.leave?.();
        frameRef.current?.destroy?.();
      } catch {}
      frameRef.current = null;
    };
  }, []);

  const handleExportConversation = () => {
    toast({
      title: "Conversation exported",
      description: "Your conversation has been prepared for your healthcare provider."
    });
  };

  const handleShareWithFamily = () => {
    toast({
      title: "Sharing options",
      description: "Choose family members to share this conversation with."
    });
  };

  const fetchSourceDocumentation = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      toast({ 
        title: "Error", 
        description: "Not authenticated", 
        variant: "destructive" 
      });
      return;
    }

    setLoadingSourceDoc(true);
    try {
      const response = await fetch(`${backendBase}/source-documentation`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSourceDocData(data);
        setSourceDocOpen(true);
      } else {
        const errorData = await response.json();
        toast({
          title: "Documentation Not Available",
          description: errorData.message || "Source documentation could not be loaded.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("[SourceDoc] Fetch error:", error);
      toast({
        title: "Error",
        description: "Failed to load source documentation",
        variant: "destructive"
      });
    } finally {
      setLoadingSourceDoc(false);
    }
  };

  const suggestedQuestions = [
    "What does this mean for my children?",
    "What screening should I get?",
    "Can this be prevented?",
    "How accurate is this test?",
    "What are my treatment options?"
  ];

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            AI Genetics Counselor Chat
          </h1>
          <p className="text-muted-foreground">
            Ask any questions about your genetic test results
          </p>
          <Badge variant="outline" className="mt-2">
            <Sparkles className="h-4 w-4 mr-1" />
            Powered by Advanced AI
          </Badge>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Video Chat Interface */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="shadow-professional h-[600px] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        AI Genetics Counselor
                      </CardTitle>
                      <CardDescription>
                        Live video consultation with AI specialist
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {!isVideoCall ? (
                        <Button
                          onClick={startVideoCall}
                          disabled={isConnecting}
                          className="bg-primary text-primary-foreground"
                        >
                          {isConnecting ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Connecting...
                            </div>
                          ) : (
                            <>
                              <Video className="h-4 w-4 mr-2" />
                              Start Video Call
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          onClick={endVideoCall}
                        >
                          <PhoneOff className="h-4 w-4 mr-2" />
                          End Call
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Conversation continuation options - only show when not in a call */}
                  {!isVideoCall && existingConversationId && (
                    <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Previous conversation found</span>
                        {existingConversationDate && (
                          <span className="ml-2">
                            from {new Date(existingConversationDate).toLocaleDateString()} at{' '}
                            {new Date(existingConversationDate).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="start-new" 
                          checked={startNewConversation}
                          onCheckedChange={(checked) => setStartNewConversation(checked === true)}
                        />
                        <Label 
                          htmlFor="start-new" 
                          className="text-sm font-normal cursor-pointer"
                        >
                          Start new conversation (instead of continuing previous one)
                        </Label>
                      </div>
                      {!startNewConversation && (
                        <div className="text-xs text-muted-foreground bg-primary/5 border-l-2 border-primary pl-2 py-1">
                          ✓ Will continue your previous conversation
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              {/* Video Chat Content */}
              <CardContent className="flex-1 flex flex-col min-h-0">
                {/* Video container - Always rendered so ref is available */}
                <div className="flex-1 bg-black rounded-lg overflow-hidden relative">
                  {/* Daily.co iframe container - always exists */}
                  <div 
                    ref={containerRef} 
                    className={`w-full h-full ${isVideoCall && conversationId ? 'block' : 'hidden'}`} 
                  />
                  
                  {/* Live indicator - only show when call is active */}
                  {isVideoCall && conversationId && (
                    <div className="absolute bottom-4 left-4 right-4 z-10">
                      <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
                        <p className="text-white text-sm">🔴 Live video consultation with AI genetics counselor</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Placeholder - show when not in call */}
                  {!isVideoCall && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/20">
                      <div className="text-center space-y-4">
                        <div className="w-24 h-24 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
                          <Video className="h-12 w-12 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-foreground">
                            Ready for Video Consultation
                          </h3>
                          <p className="text-muted-foreground mt-2">
                            Connect with your AI genetics counselor for personalized guidance about your test results.
                          </p>
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>✓ Real-time video conversation</p>
                          <p>✓ Specialized in genetic counseling</p>
                          <p>✓ Secure and private consultation</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Backup */}
                {!isVideoCall && (
                  <div className="mt-4 space-y-3">
                    <Separator />
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        Or ask questions via text while video loads
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Type your question here..."
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        className="flex-1"
                      />
                      <Button onClick={handleSendMessage} disabled={!inputMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Transcript Display - Moved here right below video */}
            <Card className="shadow-professional">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-primary" />
                      Live Conversation Transcript
                    </CardTitle>
                    <CardDescription>
                      {isVideoCall ? (
                        <>Showing all conversations from the last 2 hours (most recent at top)</>
                      ) : existingConversationId && !startNewConversation ? (
                        <>Showing previous conversation from {existingConversationDate && new Date(existingConversationDate).toLocaleDateString()} (most recent at top)</>
                      ) : (
                        <>Showing conversations from the last 2 hours (most recent at top)</>
                      )}
                    </CardDescription>
                  </div>
                  {Object.keys(feedbackChanges).length > 0 && (
                    <Button 
                      onClick={saveFeedback} 
                      disabled={savingFeedback}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {savingFeedback ? 'Saving...' : `Save Feedback (${Object.keys(feedbackChanges).length})`}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {transcript.length > 0 ? (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {transcript.map((turn, idx) => {
                      const key = `${turn.conversation_id}-${turn.ordinal}`;
                      const currentFeedback = feedbackChanges[key] || {
                        status: turn.feedback_status || 0,
                        text: turn.feedback || '',
                        conversation_id: turn.conversation_id,
                        ordinal: turn.ordinal
                      };
                      const hasUnsavedChanges = !!feedbackChanges[key];
                      
                      return (
                        <div
                          key={key}
                          className={`p-4 rounded-lg ${
                            turn.role === 'user' 
                              ? 'bg-blue-50 border border-blue-200' 
                              : 'bg-gray-50 border border-gray-200'
                          } ${hasUnsavedChanges ? 'ring-2 ring-primary/50' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={turn.role === 'user' ? 'default' : 'secondary'} className="text-sm">
                                {turn.role === 'user' ? '👤 You' : '🤖 Assistant'}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {new Date(turn.created_at).toLocaleTimeString()}
                              </span>
                              {hasUnsavedChanges && (
                                <Badge variant="outline" className="text-xs">
                                  Unsaved
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant={currentFeedback.status === 1 ? 'default' : 'ghost'}
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleFeedbackStatus(turn.conversation_id, turn.ordinal, currentFeedback.status === 1 ? 0 : 1)}
                              >
                                <ThumbsUp className={`h-4 w-4 ${currentFeedback.status === 1 ? 'fill-current' : ''}`} />
                              </Button>
                              <Button
                                variant={currentFeedback.status === 2 ? 'destructive' : 'ghost'}
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleFeedbackStatus(turn.conversation_id, turn.ordinal, currentFeedback.status === 2 ? 0 : 2)}
                              >
                                <ThumbsDown className={`h-4 w-4 ${currentFeedback.status === 2 ? 'fill-current' : ''}`} />
                              </Button>
                            </div>
                          </div>
                          <div className="text-base text-gray-800 leading-relaxed mb-2">
                            {typeof turn.content === 'string' 
                              ? turn.content 
                              : turn.content?.text || JSON.stringify(turn.content)}
                          </div>
                          {currentFeedback.status > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-300">
                              <textarea
                                value={currentFeedback.text}
                                onChange={(e) => handleFeedbackText(turn.conversation_id, turn.ordinal, e.target.value)}
                                placeholder="Add optional feedback comment..."
                                className="w-full p-2 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                rows={2}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-base font-medium">
                      {existingConversationId && !startNewConversation && !isVideoCall
                        ? 'Loading previous conversation...' 
                        : 'No recent conversations'}
                    </p>
                    <p className="text-sm mt-2">
                      {existingConversationId && !startNewConversation && !isVideoCall
                        ? 'If this takes too long, check your connection'
                        : 'Transcript will appear when you start a conversation'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Suggested Questions */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Common Questions</CardTitle>
                <CardDescription>Click to ask</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestedQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start text-left h-auto p-3"
                    onClick={() => setInputMessage(question)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm whitespace-normal break-words">{question}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start items-center h-auto py-3"
                  onClick={fetchSourceDocumentation}
                  disabled={loadingSourceDoc}
                >
                  <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal break-words text-left">
                    {loadingSourceDoc ? "Loading..." : "View Source Documentation"}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start items-center h-auto py-3"
                  onClick={handleExportConversation}
                >
                  <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal break-words text-left">Export for Doctor</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start items-center h-auto py-3"
                  onClick={handleShareWithFamily}
                >
                  <Share className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal break-words text-left">Share with Family</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start items-center h-auto py-3"
                  onClick={() => toast({ title: "Download Transcript", description: "Transcript download will be available soon." })}
                >
                  <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal break-words text-left">Download Transcript</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start items-center h-auto py-3"
                  onClick={() => toast({ title: "Download Summary", description: "Summary download will be available soon." })}
                >
                  <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal break-words text-left">Download Summary</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start items-center h-auto py-3"
                  onClick={() => toast({ title: "Download Common Questions", description: "Common questions download will be available soon." })}
                >
                  <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal break-words text-left">Download Common Questions</span>
                </Button>
              </CardContent>
            </Card>

            {/* Source Documentation Dialog */}
            <Dialog open={sourceDocOpen} onOpenChange={setSourceDocOpen}>
              <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Source Documentation
                  </DialogTitle>
                  <DialogDescription>
                    {sourceDocData && (
                      <div className="space-y-1 text-sm">
                        <p><strong>Gene:</strong> {sourceDocData.gene}</p>
                        <p><strong>Mutation:</strong> {sourceDocData.mutation}</p>
                        <p><strong>Classification:</strong> {sourceDocData.classification}</p>
                        {sourceDocData.source_retrieved_at && (
                          <p className="text-xs text-muted-foreground">
                            Retrieved: {new Date(sourceDocData.source_retrieved_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
                  {sourceDocData && (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {sourceDocData.source_document}
                      </ReactMarkdown>
                    </div>
                  )}
                </ScrollArea>
              </DialogContent>
            </Dialog>

            {/* Disclaimer */}
            <Card className="bg-secondary border-l-4 border-primary">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      This AI provides educational information only. 
                      Always consult healthcare professionals for medical decisions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QAScreen;