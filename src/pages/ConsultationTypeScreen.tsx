import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Phone, ArrowLeft, Sparkles } from "lucide-react";

const ConsultationTypeScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">
              Choose Your Consultation Type
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect with our AI genetics counselor through video or audio consultation.
            Both options provide the same expert guidance tailored to your needs.
          </p>
        </div>

        {/* Consultation Options */}
        <div className="grid md:grid-cols-2 gap-6 py-6">
          {/* Video Consultation Card */}
          <Card className="shadow-professional hover:shadow-xl transition-shadow cursor-pointer border-2 hover:border-primary">
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center mb-4">
                <Video className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">Video Consultation</CardTitle>
              <CardDescription className="text-base">
                Face-to-face interaction with AI counselor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Visual AI avatar for personal connection</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Real-time video conversation</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>See facial expressions and gestures</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Text chat backup available</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">⚠</span>
                  <span>Requires camera and higher bandwidth</span>
                </p>
              </div>
              
              <Button 
                onClick={() => navigate("/qa")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
              >
                <Video className="h-5 w-5 mr-2" />
                Start Video Consultation
              </Button>
            </CardContent>
          </Card>

          {/* Audio Consultation Card */}
          <Card className="shadow-professional hover:shadow-xl transition-shadow cursor-pointer border-2 hover:border-primary">
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-full flex items-center justify-center mb-4">
                <Phone className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Audio Consultation</CardTitle>
              <CardDescription className="text-base">
                Voice-only conversation with AI counselor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Natural voice conversation</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Lower bandwidth requirements</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>No camera needed</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>More privacy and comfort</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Works on slower connections</span>
                </p>
              </div>
              
              <Button 
                onClick={() => navigate("/audio")}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <Phone className="h-5 w-5 mr-2" />
                Start Audio Consultation
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Back Button */}
        <div className="text-center py-4">
          <Button 
            variant="outline" 
            onClick={() => navigate("/conditions")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Results
          </Button>
        </div>

        {/* Info Box */}
        <Card className="bg-secondary/50 border-l-4 border-primary">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold text-foreground">
                  Both options provide the same expert guidance
                </p>
                <p className="text-sm text-muted-foreground">
                  Choose the format that makes you most comfortable. You can always try the other option later.
                  Both consultations are powered by advanced AI trained in genetic counseling.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConsultationTypeScreen;

