import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AnimatedSection from '@/components/AnimatedSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { consultantApplicationsService } from '@/services/consultantApplications';
import { Briefcase, CheckCircle } from 'lucide-react';

export default function ApplyConsultant() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'male' as 'male' | 'female',
    qualification: '',
    current_job: '',
    location: '',
    experience: '',
    preferred_session_timing: 'Morning (8 AM – 12 PM)',
    email: '',
    phone: '',
    whatsapp: '',
    linkedin_url: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.preferred_session_timing) {
      toast({
        title: 'Validation Error',
        description: 'Please select your preferred session timing',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      await consultantApplicationsService.create({
        ...formData,
        age: parseInt(formData.age)
      });

      setSubmitted(true);
      toast({
        title: 'Application Submitted!',
        description: 'We will review your application and get back to you soon.'
      });
    } catch (error: any) {
      console.error('Error submitting application:', error?.message || error?.code || JSON.stringify(error));
      toast({
        title: 'Error',
        description: error?.message || 'Failed to submit application. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 pb-24">
          <div className="container mx-auto px-6 max-w-2xl">
            <AnimatedSection className="text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Application Submitted!
              </h1>
              <p className="text-muted-foreground mb-8">
                Thank you for applying to become a foundarly consultant. Our team will review your application and contact you within 3-5 business days.
              </p>
              <Button onClick={() => navigate('/')} className="glow-gold-sm">
                Back to Home
              </Button>
            </AnimatedSection>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6 max-w-3xl">
          <AnimatedSection className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-8 w-8 text-primary" />
            </div>
            <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Join Our Team</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold">
              Apply as <span className="text-gradient-gold">Consultant</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Share your expertise with professionals worldwide. Fill out the form below to apply.
            </p>
          </AnimatedSection>

          <AnimatedSection>
            <form onSubmit={handleSubmit} className="bg-gradient-card border border-border rounded-lg p-8 space-y-6">

              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="font-display text-lg font-semibold text-foreground">Personal Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      required
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Age *</Label>
                    <Input
                      id="age"
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      placeholder="30"
                      required
                      min="18"
                      max="100"
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value: 'male' | 'female') => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="New York, USA"
                    required
                    className="bg-background"
                  />
                </div>
              </div>

              {/* Professional Information */}
              <div className="space-y-4">
                <h3 className="font-display text-lg font-semibold text-foreground">Professional Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification *</Label>
                  <Input
                    id="qualification"
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    placeholder="MBA, PhD in Business Administration"
                    required
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="current_job">Current Job / Business *</Label>
                  <Input
                    id="current_job"
                    value={formData.current_job}
                    onChange={(e) => setFormData({ ...formData, current_job: e.target.value })}
                    placeholder="e.g. Founder at ABC Technologies / Senior Business Consultant at XYZ Corp"
                    required
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience">Experience & Expertise *</Label>
                  <Textarea
                    id="experience"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    placeholder="Describe your professional experience, areas of expertise, and what you can offer as a consultant..."
                    required
                    rows={5}
                    className="bg-background"
                  />
                </div>
              </div>

              {/* Preferred Session Timing */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">Preferred Session Timing *</h3>
                  <p className="text-xs text-muted-foreground mt-1">Select the time window when you are most available for sessions</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    'Morning (8 AM – 12 PM)',
                    'Afternoon (12 PM – 4 PM)',
                    'Evening (4 PM – 8 PM)',
                    'Night (8 PM – 10 PM)',
                    'Flexible (Any Time)'
                  ].map((option) => (
                    <label
                      key={option}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        formData.preferred_session_timing === option
                          ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                          : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      <input
                        type="radio"
                        name="preferred_session_timing"
                        value={option}
                        checked={formData.preferred_session_timing === option}
                        onChange={(e) => setFormData({ ...formData, preferred_session_timing: e.target.value })}
                        className="accent-primary h-4 w-4"
                        required
                      />
                      <span className="text-sm font-medium">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-display text-lg font-semibold text-foreground">Contact Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    required
                    className="bg-background"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 234 567 8900"
                      required
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp Number *</Label>
                    <Input
                      id="whatsapp"
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      placeholder="+1 234 567 8900"
                      required
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn Profile (Optional)</Label>
                  <Input
                    id="linkedin"
                    type="url"
                    value={formData.linkedin_url}
                    onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full glow-gold-sm"
                  size="lg"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  By submitting this form, you agree to our terms and conditions.
                </p>
              </div>
            </form>
          </AnimatedSection>
        </div>
      </main>
      <Footer />
    </div>
  );
}
