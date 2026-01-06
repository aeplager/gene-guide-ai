import { useState, useRef, useEffect } from "react";
import Vapi from "@vapi-ai/web";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Phone, PhoneOff, Mic, MicOff, AlertTriangle, MessageCircle, ThumbsUp, ThumbsDown, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type CallState = "idle" | "connecting" | "in-call" | "ended" | "error";

// PLACEHOLDER: Replace with your actual Vapi Assistant ID
const ASSISTANT_ID = "b0ff3584-411d-4ebf-aae5-30329765476f";

const LegacyVoiceCallPanel = () => {
  const [callState, setCallState] = useState<CallState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  const vapiRef = useRef<Vapi | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  // Get Vapi public key from environment
  const vapiPublicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY as string;
  
  // Backend API base URL
  const backendBase = import.meta.env.DEV ? '' : (import.meta.env.VITE_TAVUS_BACKEND_URL || '');
  
  // State for personalized greeting
  const [personalizedGreeting, setPersonalizedGreeting] = useState<string | null>(null);
  const [isLoadingGreeting, setIsLoadingGreeting] = useState<boolean>(false);
  
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
  
  // Initialize Vapi instance once
  useEffect(() => {
    if (vapiPublicKey && !vapiRef.current) {
      try {
        vapiRef.current = new Vapi(vapiPublicKey);
        console.log("[Vapi] Instance created successfully");
      } catch (error) {
        console.error("[Vapi] Failed to create instance:", error);
        setErrorMessage("Failed to initialize voice system");
        setCallState("error");
      }
    }
  }, [vapiPublicKey]);
  
  // Event handlers
  const handleCallStart = () => {
    console.log("[Vapi] Call started");
    setCallState("in-call");
    setCallDuration(0);
    
    // Start timer
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    
    // Note: Transcript polling already running from page load
    console.log("[Transcript] Audio call started, transcript will continue updating");
    
    toast({
      title: "Call Connected",
      description: "You're now connected to the AI counselor"
    });
  };
  
  const handleCallEnd = () => {
    console.log("[Vapi] Call ended");
    setCallState("ended");
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Keep transcript polling running to show conversation history
    console.log("[Transcript] Call ended, but transcript will continue showing");
    
    toast({
      title: "Call Ended",
      description: `Call duration: ${formatDuration(callDuration)}`
    });
  };
  
  const handleSpeechStart = () => {
    console.log("[Vapi] Speech started");
  };
  
  const handleSpeechEnd = () => {
    console.log("[Vapi] Speech ended");
  };
  
  const handleError = (error: { message: string }) => {
    console.error("[Vapi] Error:", error);
    setErrorMessage(error.message || "An unknown error occurred");
    setCallState("error");
    
    // Stop timer if running
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    toast({
      title: "Call Error",
      description: error.message,
      variant: "destructive"
    });
  };
  
  // Set up event listeners
  useEffect(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;
    
    vapi.on("call-start", handleCallStart);
    vapi.on("call-end", handleCallEnd);
    vapi.on("speech-start", handleSpeechStart);
    vapi.on("speech-end", handleSpeechEnd);
    vapi.on("error", handleError);
    
    // Cleanup event listeners
    return () => {
      vapi.off("call-start", handleCallStart);
      vapi.off("call-end", handleCallEnd);
      vapi.off("speech-start", handleSpeechStart);
      vapi.off("speech-end", handleSpeechEnd);
      vapi.off("error", handleError);
    };
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (transcriptPollIntervalRef.current) {
        clearInterval(transcriptPollIntervalRef.current);
      }
      if (vapiRef.current && callState === "in-call") {
        try {
          vapiRef.current.stop();
        } catch (error) {
          console.error("[Vapi] Cleanup error:", error);
        }
      }
    };
  }, [callState]);
  
  // Start polling for transcript immediately on page load
  useEffect(() => {
    console.log("[Transcript] Starting polling on page load...");
    fetchTranscript(); // Fetch immediately
    
    // Poll every 3 seconds
    transcriptPollIntervalRef.current = setInterval(() => {
      fetchTranscript();
    }, 3000);
    
    // Cleanup handled in the unmount useEffect above
  }, []); // Empty dependency array = run once on mount
  
  // Fetch transcript from backend
  const fetchTranscript = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      console.log("[Transcript] No auth token, skipping fetch");
      return;
    }

    try {
      const response = await fetch(`${backendBase}/conversations/recent-transcript`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTranscript(data.turns || []);
        console.log(`[Transcript] Fetched ${data.count || 0} turns`);
      } else {
        console.error("[Transcript] Error:", response.status);
      }
    } catch (error) {
      console.error("[Transcript] Fetch error:", error);
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
      await fetchTranscript();
      
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
  
  const startCall = async () => {
    if (!vapiRef.current) {
      setErrorMessage("Voice system not initialized");
      setCallState("error");
      return;
    }
    
    if (ASSISTANT_ID === "REPLACE_ME_WITH_ASSISTANT_ID") {
      setErrorMessage("Assistant ID not configured. Please update ASSISTANT_ID in LegacyVoiceCallPanel.tsx");
      setCallState("error");
      return;
    }
    
    setCallState("connecting");
    setErrorMessage("");
    setIsLoadingGreeting(true);
    
    try {
      // Fetch personalized greeting from backend
      console.log("[Vapi] Fetching personalized greeting from backend...");
      const token = localStorage.getItem("auth_token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${backendBase}/vapi/start`, {
        method: "GET",
        headers,
      });
      
      let greeting = null;
      let geneticContext = null;
      
      if (response.ok) {
        const data = await response.json();
        greeting = data.greeting;
        geneticContext = data.genetic_context;
        setPersonalizedGreeting(greeting);
        console.log("[Vapi] Personalized greeting received:", greeting?.substring(0, 50) + "...");
        console.log("[Vapi] Genetic context available:", !!geneticContext);
      } else {
        console.warn("[Vapi] Failed to fetch greeting, using default assistant behavior");
      }
      
      setIsLoadingGreeting(false);
      
      // Start Vapi call with correct assistant overrides format
      console.log("[Vapi] Starting call with assistant:", ASSISTANT_ID);
      
      if (greeting || geneticContext) {
        console.log("[Vapi] 🎯 Passing variables to assistant (FIXED FORMAT!)");
        
        // Build assistant overrides object (NOT wrapped in assistantOverrides key!)
        const assistantOverrides: Record<string, any> = {};
        
        if (greeting || geneticContext) {
          assistantOverrides.variableValues = {};
          
          if (greeting) {
            assistantOverrides.variableValues.greeting = greeting;
            console.log("[Vapi] ✅ Setting greeting variable:", greeting.substring(0, 50) + "...");
          }
          
          if (geneticContext) {
            assistantOverrides.variableValues.genetic_context = geneticContext;
            console.log("[Vapi] ✅ Setting genetic_context variable");
          }
        }
        
        // Pass assistantOverrides DIRECTLY as 2nd parameter (no wrapper!)
        await vapiRef.current.start(ASSISTANT_ID, assistantOverrides);
        console.log("[Vapi] ✅ Call started with personalized variables!");
      } else {
        // No overrides needed
        await vapiRef.current.start(ASSISTANT_ID);
        console.log("[Vapi] ✅ Call started with default configuration");
      }
    } catch (error) {
      console.error("[Vapi] Failed to start call:", error);
      
      // Log the full error object to see what Vapi is rejecting
      console.error("[Vapi] Full error object:", JSON.stringify(error, null, 2));
      
      const errorMsg = error instanceof Error ? error.message : "Failed to start call";
      setErrorMessage(errorMsg);
      setCallState("error");
      setIsLoadingGreeting(false);
      
      toast({
        title: "Failed to Start Call",
        description: errorMsg,
        variant: "destructive"
      });
    }
  };
  
  const stopCall = () => {
    if (!vapiRef.current) return;
    
    // Keep transcript polling running to show conversation history
    console.log("[Transcript] Manual stop, but transcript will continue showing");
    
    try {
      console.log("[Vapi] Stopping call");
      vapiRef.current.stop();
    } catch (error) {
      console.error("[Vapi] Failed to stop call:", error);
    }
  };
  
  const toggleMute = () => {
    if (!vapiRef.current) return;
    
    try {
      const newMutedState = !isMuted;
      vapiRef.current.setMuted(newMutedState);
      setIsMuted(newMutedState);
      
      toast({
        title: newMutedState ? "Microphone Muted" : "Microphone Unmuted",
        description: newMutedState ? "You are now muted" : "You are now unmuted"
      });
    } catch (error) {
      console.error("[Vapi] Failed to toggle mute:", error);
    }
  };
  
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  // Check if configuration is missing
  const isConfigMissing = !vapiPublicKey || ASSISTANT_ID === "REPLACE_ME_WITH_ASSISTANT_ID";
  const canStartCall = callState === "idle" || callState === "ended" || callState === "error";
  const isCallActive = callState === "connecting" || callState === "in-call";
  
  return (
    <>
    <Card className="shadow-professional">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Voice Call with AI Counselor
            </CardTitle>
            <CardDescription>
              Audio-only consultation using Vapi.ai
            </CardDescription>
          </div>
          {callState === "in-call" && (
            <Badge variant="default" className="animate-pulse">
              🔴 Live
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Configuration Warning */}
        {isConfigMissing && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Configuration Required:</strong>
              <ul className="list-disc list-inside mt-2 text-sm">
                {!vapiPublicKey && (
                  <li>Add VITE_VAPI_PUBLIC_KEY to your .env file</li>
                )}
                {ASSISTANT_ID === "REPLACE_ME_WITH_ASSISTANT_ID" && (
                  <li>Set ASSISTANT_ID in LegacyVoiceCallPanel.tsx</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Error Message */}
        {callState === "error" && errorMessage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {errorMessage}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Call Status Display */}
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          {/* Status Icon */}
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
            callState === "in-call" ? "bg-green-500/20 animate-pulse" :
            callState === "connecting" ? "bg-yellow-500/20" :
            callState === "error" ? "bg-red-500/20" :
            "bg-primary/20"
          }`}>
            <Phone className={`h-12 w-12 ${
              callState === "in-call" ? "text-green-500" :
              callState === "connecting" ? "text-yellow-500" :
              callState === "error" ? "text-red-500" :
              "text-primary"
            }`} />
          </div>
          
          {/* Status Text */}
          <div className="text-center">
            <h3 className="text-xl font-semibold">
              {callState === "idle" && "Ready to Start"}
              {callState === "connecting" && "Connecting..."}
              {callState === "in-call" && "Call in Progress"}
              {callState === "ended" && "Call Ended"}
              {callState === "error" && "Call Failed"}
            </h3>
            
            {/* Call Duration */}
            {(callState === "in-call" || callState === "ended") && (
              <p className="text-2xl font-mono text-muted-foreground mt-2">
                {formatDuration(callDuration)}
              </p>
            )}
            
            {/* Helpful Tips */}
            {callState === "idle" && !isConfigMissing && (
              <p className="text-sm text-muted-foreground mt-2">
                Press Start to begin your voice consultation
              </p>
            )}
            
            {callState === "connecting" && (
              <p className="text-sm text-muted-foreground mt-2">
                Establishing connection, please wait...
              </p>
            )}
            
            {callState === "in-call" && (
              <p className="text-sm text-muted-foreground mt-2">
                Speak naturally with the AI counselor
              </p>
            )}
          </div>
        </div>
        
        {/* Call Controls */}
        <div className="flex gap-3 justify-center">
          {canStartCall ? (
            <Button
              onClick={startCall}
              disabled={isConfigMissing || callState === "connecting" || isLoadingGreeting}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoadingGreeting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Preparing...
                </>
              ) : callState === "connecting" ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="h-5 w-5 mr-2" />
                  Start Call
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={stopCall}
                variant="destructive"
                size="lg"
              >
                <PhoneOff className="h-5 w-5 mr-2" />
                End Call
              </Button>
              
              <Button
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "outline"}
                size="lg"
              >
                {isMuted ? (
                  <>
                    <MicOff className="h-5 w-5 mr-2" />
                    Unmute
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    Mute
                  </>
                )}
              </Button>
            </>
          )}
        </div>
        
        {/* Info */}
        <div className="text-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            💡 Use headphones for better audio quality
          </p>
        </div>
      </CardContent>
    </Card>
    
    {/* Live Transcript Display */}
    <Card className="mt-6 shadow-professional">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Live Conversation Transcript
            </CardTitle>
            <CardDescription>
              Showing conversations from the last 2 hours (most recent at top)
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
            <p className="text-base font-medium">No recent conversations</p>
            <p className="text-sm mt-2">Start a call to see the transcript here</p>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
};

export default LegacyVoiceCallPanel;

