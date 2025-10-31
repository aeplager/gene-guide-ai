import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MessageCircle, 
  Send, 
  Video, 
  Bot,
  Download,
  Share,
  AlertTriangle,
  Sparkles,
  PhoneOff
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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

  const backendBase = import.meta.env.DEV ? '' : (import.meta.env.VITE_TAVUS_BACKEND_URL || '');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      
      const resp = await fetch(`${backendBase}/tavus/start`, { headers });
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
          <div className="lg:col-span-3">
            <Card className="shadow-professional h-[600px] flex flex-col">
              <CardHeader className="flex-shrink-0">
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
                    <span className="text-sm">{question}</span>
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
                  className="w-full justify-start"
                  onClick={handleExportConversation}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export for Doctor
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleShareWithFamily}
                >
                  <Share className="h-4 w-4 mr-2" />
                  Share with Family
                </Button>
              </CardContent>
            </Card>

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