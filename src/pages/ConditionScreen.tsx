import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Heart, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  MessageCircle,
  BookOpen,
  Users,
  Shield
} from "lucide-react";

const ConditionScreen = () => {
  const navigate = useNavigate();

  // Mock data - in real app this would come from analysis
  const mockResults = {
    gene: "BRCA1",
    variant: "c.185delAG",
    classification: "Pathogenic",
    condition: "Hereditary Breast and Ovarian Cancer Syndrome",
    riskLevel: "High",
    description: "This genetic variant significantly increases the risk of developing breast and ovarian cancers.",
    implications: [
      "Increased lifetime risk of breast cancer (60-80%)",
      "Increased lifetime risk of ovarian cancer (20-40%)",
      "Earlier onset of cancer is possible",
      "Family members may also be at risk"
    ],
    recommendations: [
      "Enhanced screening starting at age 25",
      "Consider preventive measures (discussed with healthcare team)",
      "Genetic counseling for family members",
      "Regular monitoring and checkups"
    ],
    resources: [
      "National Cancer Institute Guidelines",
      "BRCA Support Groups",
      "Preventive Care Options",
      "Family Testing Information"
    ]
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "high": return "medical-error";
      case "moderate": return "medical-warning";
      case "low": return "medical-success";
      default: return "muted";
    }
  };

  const getRiskProgress = (level: string) => {
    switch (level.toLowerCase()) {
      case "high": return 85;
      case "moderate": return 50;
      case "low": return 15;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Your Genetic Analysis Results
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Based on your genetic test results, here's what we found and what it means for you.
          </p>
        </div>

        {/* Main Results Card */}
        <Card className="shadow-professional border-l-4 border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Heart className="h-6 w-6 text-primary" />
                  {mockResults.condition}
                </CardTitle>
                <CardDescription className="text-lg mt-2">
                  Gene: <strong>{mockResults.gene}</strong> | 
                  Variant: <strong>{mockResults.variant}</strong>
                </CardDescription>
              </div>
              <Badge 
                variant="outline" 
                className={`text-${getRiskColor(mockResults.riskLevel)} border-${getRiskColor(mockResults.riskLevel)} text-lg px-4 py-2`}
              >
                {mockResults.classification}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-foreground mb-6 text-lg leading-relaxed">
              {mockResults.description}
            </p>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Risk Level:</span>
                  <Badge className={`bg-${getRiskColor(mockResults.riskLevel)}`}>
                    {mockResults.riskLevel}
                  </Badge>
                </div>
                <Progress 
                  value={getRiskProgress(mockResults.riskLevel)} 
                  className="h-3"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Health Implications */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-medical-warning" />
                What This Means for Your Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {mockResults.implications.map((implication, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>{implication}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-medical-success" />
                Recommended Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {mockResults.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-medical-success mt-0.5 flex-shrink-0" />
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Educational Resources */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent" />
              Educational Resources
            </CardTitle>
            <CardDescription>
              Learn more about your condition and connect with support networks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {mockResults.resources.map((resource, index) => (
                <Button 
                  key={index}
                  variant="outline" 
                  className="justify-start h-auto p-4"
                >
                  <div className="text-left">
                    <div className="font-medium">{resource}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center py-8">
          <Button 
            onClick={() => navigate("/qa")}
            size="lg"
            className="bg-gradient-primary px-8"
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Ask Questions & Get Support
          </Button>
          
          <Button 
            variant="outline"
            size="lg"
            className="px-8"
          >
            <Users className="h-5 w-5 mr-2" />
            Share with Family
          </Button>
        </div>

        {/* Medical Disclaimer */}
        <Card className="bg-secondary border-l-4 border-primary">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground mb-2">Important Medical Disclaimer</p>
                <p className="text-sm text-muted-foreground">
                  This analysis is for educational purposes only and does not constitute medical advice. 
                  Always consult with qualified healthcare professionals and genetic counselors for 
                  personalized medical guidance and treatment decisions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConditionScreen;