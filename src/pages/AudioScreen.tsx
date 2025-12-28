import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Phone, ArrowLeft, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LegacyVoiceCallPanel from "@/components/LegacyVoiceCallPanel";
import { useWarmLLM } from "@/hooks/useWarmLLM";

const AudioScreen = () => {
  const navigate = useNavigate();
  
  // Pre-warm the LLM when user enters this screen
  useWarmLLM();

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="max-w-5xl mx-auto p-4 space-y-6">
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

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Voice Call Panel */}
          <div className="lg:col-span-2">
            <LegacyVoiceCallPanel />
          </div>

          {/* Sidebar - Info & Tips */}
          <div className="space-y-6">
            {/* About Audio Consultation */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  About Audio Calls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  Audio consultations provide a convenient way to discuss your genetic test results 
                  without needing video.
                </p>
                <div className="space-y-2">
                  <p className="font-semibold">Features:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Natural voice conversation</li>
                    <li>Real-time AI responses</li>
                    <li>Mute/unmute controls</li>
                    <li>Lower bandwidth usage</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Tips for Best Experience */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Tips for Best Experience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>✓ Use headphones for clearer audio</p>
                <p>✓ Find a quiet environment</p>
                <p>✓ Speak clearly and naturally</p>
                <p>✓ Allow microphone permissions</p>
                <p>✓ Check your internet connection</p>
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

