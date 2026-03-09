import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import NavigationMenu from "@/components/NavigationMenu";
import { AlertTriangle, Phone, ArrowLeft, MessageCircle, FileText, Download, Share } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LegacyVoiceCallPanel from "@/components/LegacyVoiceCallPanel";
import { useWarmLLM } from "@/hooks/useWarmLLM";
import { useToast } from "@/components/ui/use-toast";

const AudioScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Pre-warm the LLM when user enters this screen
  useWarmLLM();

  const suggestedQuestions = [
    "What does this mean for my children?",
    "What screening should I get?",
    "Can this be prevented?",
    "How accurate is this test?",
    "What are my treatment options?"
  ];

  return (
    <div className="min-h-screen bg-gradient-bg">
      <NavigationMenu />
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Phone className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">
              Audio Consultation
            </h1>
          </div>
          <p className="text-muted-foreground">
            Voice-only consultation with AI genetics counselor
          </p>
          <Badge variant="outline" className="mt-2">
            Powered by Vapi.ai
          </Badge>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Voice Call Panel and Transcript */}
          <div className="lg:col-span-3">
            <LegacyVoiceCallPanel />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Common Questions */}
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
                    onClick={() => toast({ title: "Suggested Question", description: question })}
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
                  onClick={() => toast({ title: "View Source Documentation", description: "Source documentation is available on the video consultation page." })}
                >
                  <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal break-words text-left">View Source Documentation</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start items-center h-auto py-3"
                  onClick={() => toast({ title: "Export for Doctor", description: "Export for Doctor will be available soon." })}
                >
                  <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal break-words text-left">Export for Doctor</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start items-center h-auto py-3"
                  onClick={() => toast({ title: "Share with Family", description: "Share with Family will be available soon." })}
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

            {/* Navigation */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Other Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate("/qa")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Video Consultation
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

export default AudioScreen;

