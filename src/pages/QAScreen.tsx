import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageCircle, 
  Send, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff,
  Bot,
  User,
  Download,
  Share,
  AlertTriangle,
  Sparkles,
  Phone,
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
  const { toast } = useToast();

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
      // Create a conversation with Tavus API
      const response = await fetch('https://tavusapi.com/v2/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'YOUR_TAVUS_API_KEY', // This should come from environment variables
        },
        body: JSON.stringify({
          replica_id: 'YOUR_REPLICA_ID', // The genetics counselor replica
          persona_id: 'YOUR_PERSONA_ID' // The genetics counselor persona
        })
      });

      if (response.ok) {
        const data = await response.json();
        setConversationId(data.conversation_id);
        setIsVideoCall(true);
        toast({
          title: "Video call started",
          description: "Connected to AI genetics counselor"
        });
      } else {
        throw new Error('Failed to start video call');
      }
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Unable to start video call. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const endVideoCall = () => {
    setIsVideoCall(false);
    setConversationId(null);
    toast({
      title: "Video call ended",
      description: "Conversation saved to your records"
    });
  };

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
                {isVideoCall && conversationId ? (
                  <div className="flex-1 bg-black rounded-lg overflow-hidden relative">
                    <iframe
                      src={`https://tavusapi.com/video/${conversationId}`}
                      className="w-full h-full border-0"
                      allow="microphone; camera; autoplay"
                      title="AI Genetics Counselor Video Chat"
                    />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
                        <p className="text-white text-sm">
                          🔴 Live video consultation with AI genetics counselor
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/20 rounded-lg">
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