import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, User, Users, Baby } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const IntroductoryScreen = () => {
  const [relationship, setRelationship] = useState("");
  const [hasReport, setHasReport] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [manualData, setManualData] = useState({
    gene: "",
    mutation: "",
    status: ""
  });
  const [selectedLLM, setSelectedLLM] = useState("");
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadedFile(file);
      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been uploaded.`
      });
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive"
      });
    }
  };

  const handleContinue = () => {
    if (!relationship) {
      toast({
        title: "Please select relationship",
        description: "Tell us who this genetic test is for.",
        variant: "destructive"
      });
      return;
    }

    if (hasReport === "yes" && !uploadedFile) {
      toast({
        title: "Please upload your report",
        description: "Upload your genetic test report PDF.",
        variant: "destructive"
      });
      return;
    }

    if (hasReport === "no" && (!manualData.gene || !manualData.mutation || !manualData.status)) {
      toast({
        title: "Please fill in genetic information",
        description: "Provide the gene, mutation, and status information.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedLLM) {
      toast({
        title: "Please select an AI model",
        description: "Choose the AI model for your consultation.",
        variant: "destructive"
      });
      return;
    }

    // Store data and navigate
    navigate("/conditions");
  };

  const relationshipOptions = [
    { value: "self", label: "Myself", icon: User },
    { value: "child", label: "My Child", icon: Baby },
    { value: "parent", label: "My Parent", icon: Users },
    { value: "sibling", label: "My Sibling", icon: Users },
    { value: "partner", label: "My Partner", icon: Users },
    { value: "other", label: "Other Family Member", icon: Users }
  ];

  return (
    <div className="min-h-screen bg-gradient-bg p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Tell Us About Your Genetics Test
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We'll help you understand your genetic test results with personalized, 
            compassionate guidance tailored to your situation.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
          {/* Relationship Card */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Who is this test for?
              </CardTitle>
              <CardDescription>
                This helps us provide more personalized guidance and advice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={relationship} onValueChange={setRelationship}>
                <div className="grid grid-cols-2 gap-3">
                  {relationshipOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={option.value} />
                        <Label 
                          htmlFor={option.value} 
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <IconComponent className="h-4 w-4" />
                          {option.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Report Upload Card */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Genetic Test Report
              </CardTitle>
              <CardDescription>
                Do you have your genetic test report available?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={hasReport} onValueChange={setHasReport}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="has-report" />
                  <Label htmlFor="has-report">Yes, I can upload it</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="no-report" />
                  <Label htmlFor="no-report">No, I'll enter details manually</Label>
                </div>
              </RadioGroup>

              {hasReport === "yes" && (
                <div className="mt-4">
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {uploadedFile ? uploadedFile.name : "Click to upload PDF report"}
                      </p>
                    </div>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}

              {hasReport === "no" && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="gene">Gene</Label>
                    <Input
                      id="gene"
                      placeholder="e.g., BRCA1, CFTR, TP53"
                      value={manualData.gene}
                      onChange={(e) => setManualData(prev => ({ ...prev, gene: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mutation">Mutation/Variant</Label>
                    <Textarea
                      id="mutation"
                      placeholder="e.g., c.185delAG, p.Arg72Pro"
                      value={manualData.mutation}
                      onChange={(e) => setManualData(prev => ({ ...prev, mutation: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Classification Status</Label>
                    <Select onValueChange={(value) => setManualData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select classification" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="benign">Benign</SelectItem>
                        <SelectItem value="likely-benign">Likely Benign</SelectItem>
                        <SelectItem value="uncertain">Uncertain Significance (VUS)</SelectItem>
                        <SelectItem value="likely-pathogenic">Likely Pathogenic</SelectItem>
                        <SelectItem value="pathogenic">Pathogenic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Model Selection */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Choose Your AI Counselor</CardTitle>
            <CardDescription>
              Select the AI model that will help analyze and explain your results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedLLM}>
              <SelectTrigger>
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4">GPT-4 (Comprehensive Analysis)</SelectItem>
                <SelectItem value="claude">Claude (Detailed Explanations)</SelectItem>
                <SelectItem value="gemini">Gemini (Interactive Guidance)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Continue Button */}
        <div className="text-center pb-8">
          <Button 
            onClick={handleContinue}
            size="lg"
            className="bg-gradient-primary px-12"
          >
            Continue to Analysis
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IntroductoryScreen;