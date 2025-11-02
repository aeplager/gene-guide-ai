import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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
import { useWarmLLM } from "@/hooks/useWarmLLM";

const ConditionScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingDetailed, setLoadingDetailed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [detailedResults, setDetailedResults] = useState<any>(null);
  
  const backendBase = import.meta.env.DEV ? '' : (import.meta.env.VITE_TAVUS_BACKEND_URL || '');
  
  // Pre-warm the LLM when user enters this screen
  useWarmLLM();

  useEffect(() => {
    const fetchConditionAnalysis = async () => {
      const userId = localStorage.getItem('userId');
      
      console.log('[condition] Checking authentication...');
      console.log('[condition] userId from localStorage:', userId);
      
      if (!userId) {
        console.error('[condition] No userId found - redirecting to login');
        setError("Please log in first");
        setTimeout(() => navigate("/login"), 2000);
        return;
      }

      try {
        // STEP 1: Fetch BASIC info first (fast - shows immediately)
        setLoading(true);
        console.log(`[condition] ⚡ Fetching BASIC analysis for userId: ${userId}`);
        console.log(`[condition] Backend URL: ${backendBase}/condition-analysis/${userId}/basic`);
        
        const basicResponse = await fetch(`${backendBase}/condition-analysis/${userId}/basic`);
        
        console.log('[condition] Basic response status:', basicResponse.status);
        
        if (!basicResponse.ok) {
          const errorData = await basicResponse.json().catch(() => ({}));
          console.error('[condition] Error response:', errorData);
          throw new Error(errorData.message || `Failed to fetch analysis: ${basicResponse.status}`);
        }
        
        const basicData = await basicResponse.json();
        console.log('[condition] ✅ Basic analysis received:', basicData);
        setResults(basicData);
        setLoading(false);  // Page can render now!
        
        // STEP 2: Fetch DETAILED info in background (slower - fills in later)
        console.log(`[condition] 📋 Fetching DETAILED analysis for userId: ${userId}`);
        setLoadingDetailed(true);
        
        const detailedResponse = await fetch(`${backendBase}/condition-analysis/${userId}/detailed`);
        
        if (detailedResponse.ok) {
          const detailedData = await detailedResponse.json();
          console.log('[condition] ✅ Detailed analysis received:', detailedData);
          setDetailedResults(detailedData);
        } else {
          console.error('[condition] Failed to fetch detailed analysis (non-fatal)');
          // Non-fatal - page still shows basic info
        }
        
      } catch (err: any) {
        console.error('[condition] Error fetching analysis:', err);
        setError(err.message || "Failed to load analysis");
        setLoading(false);
      } finally {
        setLoadingDetailed(false);
      }
    };

    fetchConditionAnalysis();
  }, [navigate, backendBase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground text-lg">Analyzing your genetic information...</p>
          <p className="text-muted-foreground text-sm mt-2">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-medical-error flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{error}</p>
            <div className="flex gap-2">
              <Button onClick={() => navigate("/introduction")} variant="outline" className="flex-1">
                Go to Introduction
              </Button>
              <Button onClick={() => window.location.reload()} className="flex-1">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  // Use 'results' for the rest of the component
  // Combine basic and detailed results for rendering
  const displayResults = results;

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
                  {displayResults.condition}
                </CardTitle>
                <CardDescription className="text-lg mt-2">
                  Gene: <strong>{displayResults.gene}</strong> | 
                  Variant: <strong>{displayResults.variant}</strong>
                </CardDescription>
              </div>
              <Badge 
                variant="outline" 
                className={`text-${getRiskColor(displayResults.riskLevel)} border-${getRiskColor(displayResults.riskLevel)} text-lg px-4 py-2`}
              >
                {displayResults.classification}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-foreground mb-6 text-lg leading-relaxed">
              {displayResults.description}
            </p>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Risk Level:</span>
                  <Badge className={`bg-${getRiskColor(displayResults.riskLevel)}`}>
                    {displayResults.riskLevel}
                  </Badge>
                </div>
                <Progress 
                  value={getRiskProgress(displayResults.riskLevel)} 
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
              {loadingDetailed ? (
                // Loading skeleton
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-0.5 flex-shrink-0" />
                      <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : detailedResults?.implications ? (
                // Actual data
                <ul className="space-y-3">
                  {detailedResults.implications.map((implication: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span>{implication}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Unable to load health implications.</p>
              )}
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
              {loadingDetailed ? (
                // Loading skeleton
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-0.5 flex-shrink-0" />
                      <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : detailedResults?.recommendations ? (
                // Actual data
                <ul className="space-y-3">
                  {detailedResults.recommendations.map((recommendation: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-medical-success mt-0.5 flex-shrink-0" />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Unable to load recommendations.</p>
              )}
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
            {loadingDetailed ? (
              // Loading skeleton
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ))}
              </div>
            ) : detailedResults?.resources ? (
              // Actual data
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {detailedResults.resources.map((resource: string, index: number) => (
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
            ) : (
              <p className="text-muted-foreground">Unable to load resources.</p>
            )}
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