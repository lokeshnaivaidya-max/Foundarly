import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Save, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { settingsService } from "@/services/settings";
import { storageService } from "@/services/storage";

interface ContentField {
  key: string;
  label: string;
  type: "input" | "textarea";
  value: string;
}

interface ContentSection {
  id: string;
  title: string;
  fields: ContentField[];
}

export default function AdminContent() {
  const { toast } = useToast();
  const [openSections, setOpenSections] = useState<string[]>(["logo"]);
  const [logoText, setLogoText] = useState("Foundarly");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllContent();
  }, []);

  const loadAllContent = async () => {
    try {
      const settings = await settingsService.getAll();
      
      // Load logo settings
      const logoTextSetting = settings.find(s => s.setting_key === 'site_logo_text');
      const logoUrlSetting = settings.find(s => s.setting_key === 'site_logo_url');
      
      if (logoTextSetting) setLogoText(logoTextSetting.setting_value || 'Foundarly');
      if (logoUrlSetting) {
        setLogoUrl(logoUrlSetting.setting_value);
        setLogoPreview(logoUrlSetting.setting_value);
      }

      // Load content sections
      const contentSections: ContentSection[] = [
        {
          id: "hero",
          title: "Homepage Hero",
          fields: [
            { key: "hero_headline", label: "Headline", type: "input", value: settings.find(s => s.setting_key === 'hero_headline')?.setting_value || "Strategic Conversations That Move You Forward." },
            { key: "hero_subheadline", label: "Subheadline", type: "textarea", value: settings.find(s => s.setting_key === 'hero_subheadline')?.setting_value || "Private 1-on-1 video consultations with industry experts in career growth, business strategy, and personal transformation." },
            { key: "hero_primary_cta", label: "Primary Button Text", type: "input", value: settings.find(s => s.setting_key === 'hero_primary_cta')?.setting_value || "Book Your Session" },
            { key: "hero_secondary_cta", label: "Secondary Button Text", type: "input", value: settings.find(s => s.setting_key === 'hero_secondary_cta')?.setting_value || "Explore Experts" },
          ],
        },
        {
          id: "about",
          title: "About Section",
          fields: [
            { key: "about_title", label: "Title", type: "input", value: settings.find(s => s.setting_key === 'about_title')?.setting_value || "The Vision Behind Foundarly" },
            { key: "about_description", label: "Description", type: "textarea", value: settings.find(s => s.setting_key === 'about_description')?.setting_value || "Founded on the belief that the right conversation at the right time can change everything." },
          ],
        },
      ];

      setSections(contentSections);
    } catch (error) {
      console.error('Error loading content:', error);
      toast({
        title: "Error",
        description: "Failed to load content. Make sure site_settings table exists.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoUrl(null);
  };

  const handleSaveLogo = async () => {
    setIsLoading(true);
    try {
      let uploadedUrl = logoUrl;

      // Upload new logo if file is selected
      if (logoFile) {
        uploadedUrl = await storageService.uploadFile('site-assets', logoFile, `logo-${Date.now()}`);
      }

      // Update settings
      await settingsService.upsert('site_logo_text', logoText);
      await settingsService.upsert('site_logo_url', uploadedUrl);

      toast({ 
        title: "Saved", 
        description: "Logo settings updated successfully." 
      });

      // Reload settings
      await loadAllContent();
      setLogoFile(null);
    } catch (error) {
      console.error('Error saving logo:', error);
      toast({ 
        title: "Error", 
        description: "Failed to save logo settings.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateFieldValue = (sectionId: string, fieldKey: string, value: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          fields: section.fields.map(field => 
            field.key === fieldKey ? { ...field, value } : field
          )
        };
      }
      return section;
    }));
  };

  const handleSaveSection = async (section: ContentSection) => {
    setIsLoading(true);
    try {
      // Save all fields in the section
      await Promise.all(
        section.fields.map(field => 
          settingsService.upsert(field.key, field.value)
        )
      );

      toast({ 
        title: "Saved", 
        description: `${section.title} content updated successfully.` 
      });
    } catch (error) {
      console.error('Error saving section:', error);
      toast({ 
        title: "Error", 
        description: "Failed to save content. Make sure site_settings table exists.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };



  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Content Control</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage all website content from one place.</p>
      </div>

      <div className="space-y-3">
        {/* Logo Section */}
        <Collapsible
          open={openSections.includes("logo")}
          onOpenChange={() => toggleSection("logo")}
        >
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors">
              <h2 className="font-display text-base font-semibold text-foreground">Site Logo</h2>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  openSections.includes("logo") ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                <div className="space-y-2">
                  <Label className="text-sm">Logo Text</Label>
                  <Input 
                    value={logoText} 
                    onChange={(e) => setLogoText(e.target.value)}
                    placeholder="Enter site name"
                    className="bg-background border-border" 
                  />
                  <p className="text-xs text-muted-foreground">This text will be displayed if no logo image is uploaded</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Logo Image (Optional)</Label>
                  {logoPreview ? (
                    <div className="relative inline-block">
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        className="h-16 w-auto object-contain border border-border rounded-lg p-2 bg-background"
                      />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileChange}
                        className="bg-background border-border"
                        id="logo-upload"
                      />
                      <Label htmlFor="logo-upload" className="cursor-pointer">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
                          </span>
                        </Button>
                      </Label>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Recommended: PNG or SVG, max 200px height</p>
                </div>

                <div className="flex gap-3 pt-3 border-t border-border">
                  <Button 
                    className="glow-gold-sm" 
                    size="sm" 
                    onClick={handleSaveLogo}
                    disabled={isLoading}
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" /> 
                    {isLoading ? "Saving..." : "Save Logo"}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {sections.map((section) => (
          <Collapsible
            key={section.id}
            open={openSections.includes(section.id)}
            onOpenChange={() => toggleSection(section.id)}
          >
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors">
                <h2 className="font-display text-base font-semibold text-foreground">{section.title}</h2>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    openSections.includes(section.id) ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                  {section.fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label className="text-sm">{field.label}</Label>
                      {field.type === "input" ? (
                        <Input 
                          value={field.value} 
                          onChange={(e) => updateFieldValue(section.id, field.key, e.target.value)}
                          className="bg-background border-border" 
                        />
                      ) : (
                        <Textarea 
                          rows={4} 
                          value={field.value}
                          onChange={(e) => updateFieldValue(section.id, field.key, e.target.value)}
                          className="bg-background border-border" 
                        />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-3 pt-3 border-t border-border">
                    <Button 
                      className="glow-gold-sm" 
                      size="sm" 
                      onClick={() => handleSaveSection(section)}
                      disabled={isLoading}
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" /> 
                      {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
