import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, User, Users, Baby, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useWarmLLM } from "@/hooks/useWarmLLM";

interface PersonaTestType {
  PersonaTestTypeID: number;
  PersonaTestType: string;
}

interface ClassificationType {
  ClassificationTypeID: number;
  ClassificationType: string;
}

const IntroductoryScreen = () => {
  const [relationship, setRelationship] = useState("");
  const [hasReport, setHasReport] = useState("no"); // Default to manual entry
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [manualData, setManualData] = useState({
    gene: "",
    mutation: "",
    status: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [personaTestTypes, setPersonaTestTypes] = useState<PersonaTestType[]>([]);
  const [classificationTypes, setClassificationTypes] = useState<ClassificationType[]>([]);
  const [selectedClassificationId, setSelectedClassificationId] = useState<string>("");
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const backendBase = import.meta.env.DEV ? '' : (import.meta.env.VITE_TAVUS_BACKEND_URL || '');
  
  // Pre-warm the LLM when user enters this screen
  useWarmLLM();

  // Fetch PersonaTestType options
  useEffect(() => {
    const fetchPersonaTestTypes = async () => {
      try {
        const start = performance.now();
        console.log('[intro] ⏱️ fetching persona-test-types...');
        const resp = await fetch(`${backendBase}/persona-test-types`);
        const elapsed = performance.now() - start;
        console.log(`[intro] ⏱️ persona-test-types completed in ${elapsed.toFixed(0)}ms`);
        if (resp.ok) {
          const data = await resp.json();
          setPersonaTestTypes(data);
        }
      } catch (error) {
        console.error("Failed to fetch persona test types", error);
      }
    };
    fetchPersonaTestTypes();
  }, [backendBase]);

  // Fetch ClassificationType options
  useEffect(() => {
    const fetchClassificationTypes = async () => {
      try {
        const start = performance.now();
        console.log('[intro] ⏱️ fetching classification types from', `${backendBase}/classification-types`);
        const resp = await fetch(`${backendBase}/classification-types`);
        const elapsed = performance.now() - start;
        console.log(`[intro] ⏱️ classification-types completed in ${elapsed.toFixed(0)}ms`);
        if (resp.ok) {
          const data = await resp.json();
          console.log('[intro] classification types loaded:', data);
          setClassificationTypes(data);
        } else {
          console.error('[intro] classification types fetch failed', resp.status);
          toast({
            title: "Failed to load classification types",
            description: "Database connection may be down. Check backend logs.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("[intro] Failed to fetch classification types", error);
        toast({
          title: "Error loading data",
          description: "Could not connect to backend.",
          variant: "destructive"
        });
      }
    };
    fetchClassificationTypes();
  }, [backendBase, toast]);

  // Fetch existing BaseInformation to pre-populate the form
  useEffect(() => {
    const fetchExistingData = async () => {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.log('[intro] No userId found, skipping pre-population');
        return;
      }

      try {
        const start = performance.now();
        console.log('[intro] ⏱️ Fetching existing data for userId:', userId);
        const resp = await fetch(`${backendBase}/base-information/${userId}`);
        const elapsed = performance.now() - start;
        console.log(`[intro] ⏱️ base-information completed in ${elapsed.toFixed(0)}ms`);
        
        if (resp.ok) {
          const data = await resp.json();
          console.log('[intro] Existing data fetched:', data);
          
          if (data.exists) {
            // Pre-populate form fields
            console.log('[intro] ✅ Pre-populating form with existing data');
            
            // Set PersonaTestType (radio button selection)
            if (data.personaTestTypeId) {
              // Set the radio button using the PersonaTestTypeID
              setRelationship(data.personaTestTypeId.toString());
              console.log('[intro] Set relationship to ID:', data.personaTestTypeId, 'Type:', data.personaTestType);
            }
            
            // Set gene and mutation
            if (data.gene) {
              setManualData(prev => ({ ...prev, gene: data.gene }));
              console.log('[intro] Set gene to:', data.gene);
            }
            if (data.mutation) {
              setManualData(prev => ({ ...prev, mutation: data.mutation }));
              console.log('[intro] Set mutation to:', data.mutation);
            }
            
            // Set ClassificationType dropdown
            if (data.classificationTypeId) {
              setSelectedClassificationId(data.classificationTypeId.toString());
              setManualData(prev => ({ ...prev, status: data.classificationType }));
              console.log('[intro] Set classification to:', data.classificationType);
            }
            
            // Note: We're keeping the form in manual entry mode even if data was uploaded before
            // If you want to show "yes" for hasReport, uncomment the line below:
            // if (data.uploaded === true) setHasReport("yes");
            
            toast({
              title: "Existing data loaded",
              description: "Your previously saved information has been loaded."
            });
          } else {
            console.log('[intro] ℹ️  No existing data found for this user');
          }
        } else {
          console.warn('[intro] Failed to fetch existing data:', resp.status);
        }
      } catch (error) {
        console.error('[intro] Error fetching existing data:', error);
        // Non-fatal - user can still fill out the form
      }
    };

    // Only fetch after personaTestTypes are loaded (needed for mapping)
    if (personaTestTypes.length > 0) {
      fetchExistingData();
    }
  }, [backendBase, toast, personaTestTypes]); // Depend on personaTestTypes being loaded

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

  const handleSave = async () => {
    // Check if PersonaTestTypes have loaded from database
    if (personaTestTypes.length === 0) {
      toast({
        title: "Please wait",
        description: "Loading relationship options from database...",
        variant: "destructive"
      });
      console.error('[intro] PersonaTestTypes not loaded yet');
      return;
    }

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

    if (hasReport === "no" && (!manualData.gene || !manualData.mutation || !selectedClassificationId)) {
      toast({
        title: "Please fill in genetic information",
        description: "Provide the gene, mutation, and classification status.",
        variant: "destructive"
      });
      return;
    }

    // Map relationship (which is now PersonaTestTypeID) to the actual PersonaTestType object
    console.log('[intro] Looking up PersonaTestType for relationship ID:', relationship);
    console.log('[intro] Available PersonaTestTypes:', personaTestTypes);
    
    const personaTestType = personaTestTypes.find(
      p => p.PersonaTestTypeID.toString() === relationship
    );

    if (!personaTestType) {
      toast({
        title: "Invalid relationship selection",
        description: `Could not find relationship ID "${relationship}" in database. Please re-select a valid option.`,
        variant: "destructive"
      });
      console.error('[intro] ❌ Could not find PersonaTestType for relationship ID:', relationship);
      console.error('[intro] Available IDs:', personaTestTypes.map(pt => pt.PersonaTestTypeID));
      return;
    }
    
    console.log('[intro] ✅ Mapped relationship ID', relationship, 'to PersonaTestType:', personaTestType.PersonaTestType);

    if (!selectedClassificationId) {
      toast({
        title: "Please select classification status",
        description: "Classification status is required.",
        variant: "destructive"
      });
      return;
    }

        setIsSaving(true);
        setSaveSuccess(false);
        try {
          // Get authenticated user ID from localStorage
          const userId = localStorage.getItem('userId');
          
          console.log('='.repeat(80));
          console.log('🔍 [intro] CHECKING AUTHENTICATION');
          console.log('='.repeat(80));
          console.log('[intro] localStorage.userId:', userId);
          console.log('[intro] localStorage keys:', Object.keys(localStorage));
          console.log('='.repeat(80));
          
          if (!userId) {
            console.error('[intro] ❌ No userId in localStorage - redirecting to login');
            toast({
              title: "Authentication required",
              description: "Please log in again.",
              variant: "destructive"
            });
            navigate("/");
            return;
          }
          
          console.log('[intro] ✅ Using authenticated userId:', userId);
      
      const payload = {
        userId: userId,
        personaTestTypeId: personaTestType.PersonaTestTypeID,
        classificationTypeId: parseInt(selectedClassificationId),
        uploaded: hasReport === "yes",
        gene: manualData.gene || null,
        mutation: manualData.mutation || null
      };

      console.log('='.repeat(80));
      console.log('📤 [intro] SENDING SAVE REQUEST');
      console.log('='.repeat(80));
      console.log('[intro] Payload:', JSON.stringify(payload, null, 2));
      console.log('[intro] Backend URL:', `${backendBase}/base-information`);
      console.log('='.repeat(80));

      const resp = await fetch(`${backendBase}/base-information`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        const result = await resp.json();
        console.log('[intro] save success', result);
        setSaveSuccess(true);
        toast({
          title: "✅ Saved successfully",
          description: "Your genetic information has been saved to the database."
        });
        // Auto-hide success banner after 5 seconds
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        const errorData = await resp.json();
        console.error('[intro] save failed', errorData);
        throw new Error(errorData.message || 'Save failed');
      }
    } catch (error) {
      console.error("[intro] Save error", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save information.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
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

    if (hasReport === "no" && (!manualData.gene || !manualData.mutation || !selectedClassificationId)) {
      toast({
        title: "Please fill in genetic information",
        description: "Provide the gene, mutation, and classification status.",
        variant: "destructive"
      });
      return;
    }

    // Store data and navigate
    navigate("/conditions");
  };

  // Map PersonaTestType labels to icons
  const getIconForPersonaType = (label: string) => {
    if (label.toLowerCase().includes('myself')) return User;
    if (label.toLowerCase().includes('child')) return Baby;
    return Users;
  };

  // Build relationship options from database PersonaTestTypes when available
  // Falls back to static options if database hasn't loaded yet
  const relationshipOptions = personaTestTypes.length > 0 
    ? personaTestTypes.map(pt => ({
        value: pt.PersonaTestTypeID.toString(),
        label: pt.PersonaTestType,
        icon: getIconForPersonaType(pt.PersonaTestType)
      }))
    : [
        // Fallback static options (will be replaced by database values once loaded)
        // Note: These IDs may not match database - they're just placeholders
        { value: "1", label: "Myself", icon: User },
        { value: "2", label: "My Child", icon: Baby },
        { value: "3", label: "My Parent", icon: Users },
        { value: "4", label: "My Sibling", icon: Users },
        { value: "5", label: "My Partner", icon: Users },
        { value: "6", label: "Other Family Member", icon: Users }
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

        {/* Success Banner */}
        {saveSuccess && (
          <Card className="shadow-card border-green-500 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                  <Save className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-900">Successfully Saved!</h3>
                  <p className="text-sm text-green-700">
                    Your genetic information has been saved to the database.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                    <Select 
                      value={selectedClassificationId} 
                      onValueChange={setSelectedClassificationId}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select classification" />
                      </SelectTrigger>
                      <SelectContent>
                        {classificationTypes.length > 0 ? (
                          classificationTypes.map((ct) => (
                            <SelectItem 
                              key={ct.ClassificationTypeID} 
                              value={ct.ClassificationTypeID.toString()}
                            >
                              {ct.ClassificationType}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="loading" disabled>
                            Loading...
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 pb-8">
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
            variant="outline"
            className="px-12"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Saving...
              </div>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
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
