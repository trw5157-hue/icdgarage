import { useState, useEffect } from "react";
import { useAuth } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MechanicDashboard = () => {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [notes, setNotes] = useState("");
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusChangingJob, setStatusChangingJob] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API}/jobs`);
      setJobs(response.data);
    } catch (error) {
      toast.error("Failed to fetch jobs");
    }
  };

  const handleStatusUpdate = async (jobId, newStatus) => {
    try {
      await axios.patch(`${API}/jobs/${jobId}`, { status: newStatus });
      toast.success(`Job marked as ${newStatus}`);
      fetchJobs();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleConfirmComplete = async (jobId) => {
    try {
      await axios.patch(`${API}/jobs/${jobId}`, { 
        confirm_complete: true,
        status: "Work complete"
      });
      toast.success("Job marked as complete!");
      fetchJobs();
    } catch (error) {
      toast.error("Failed to confirm completion");
    }
  };

  const handleAddNotes = async (jobId) => {
    if (!notes.trim()) {
      toast.error("Please enter notes");
      return;
    }
    try {
      await axios.patch(`${API}/jobs/${jobId}`, { notes });
      toast.success("Notes added successfully");
      setNotes("");
      setSelectedJob(null);
      fetchJobs();
    } catch (error) {
      toast.error("Failed to add notes");
    }
  };

  const handleChecklistUpdate = async (jobId, checklist) => {
    try {
      await axios.put(`${API}/jobs/${jobId}/checklist`, checklist);
      toast.success("Checklist updated!");
      fetchJobs();
    } catch (error) {
      toast.error("Failed to update checklist");
    }
  };

  const toggleChecklistItem = (job, index) => {
    const updatedChecklist = [...(job.checklist || [])];
    updatedChecklist[index].completed = !updatedChecklist[index].completed;
    handleChecklistUpdate(job.id, updatedChecklist);
  };


  const getStatusBadge = (status, job) => {
    const statusClasses = {
      "Car Received": "bg-gray-500",
      "Diagnosis Done": "bg-yellow-500",
      "Quotation sent": "bg-yellow-500",
      "Customer Confirmed": "bg-orange-500",
      "Parts ordered": "bg-orange-500",
      "In Progress": "bg-orange-500",
      "Pending": "bg-red-500",
      "Work complete": "bg-blue-500",
      "Washed": "bg-blue-500",
      "Ready for delivery": "bg-purple-500",
      "Delivered": "bg-green-500"
    };
    return (
      <Badge 
        className={`${statusClasses[status] || 'bg-gray-500'} text-white cursor-pointer hover:opacity-80`}
        onClick={() => {
          setStatusChangingJob(job);
          setShowStatusDialog(true);
        }}
      >
        {status}
      </Badge>
    );
  };

  const pendingJobs = jobs.filter(j => !["Work complete", "Washed", "Ready for delivery", "Delivered"].includes(j.status));
  const completedJobs = jobs.filter(j => ["Work complete", "Washed", "Ready for delivery", "Delivered"].includes(j.status));

  return (
    <div className="min-h-screen bg-black text-white pb-8" data-testid="mechanic-dashboard">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src={process.env.REACT_APP_LOGO_URL} 
              alt="ICD Tuning" 
              className="h-14 md:h-16 w-auto"
            />
            <div>
              <h1 className="text-xl md:text-2xl font-bold heading-font text-red-600">ICD TUNING</h1>
              <p className="text-xs md:text-sm text-gray-400">Mechanic Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-3">
            <span className="text-xs md:text-sm text-gray-400 hidden sm:inline">Welcome, {user?.full_name}</span>
            <Button 
              onClick={logout} 
              size="sm"
              variant="outline" 
              className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white text-xs"
              data-testid="logout-button"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-500">{pendingJobs.length}</div>
                <div className="text-sm text-gray-400 mt-1">Active Jobs</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500">{completedJobs.length}</div>
                <div className="text-sm text-gray-400 mt-1">Completed</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800 col-span-2 md:col-span-1">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">{jobs.length}</div>
                <div className="text-sm text-gray-400 mt-1">Total Assigned</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Jobs */}
        <div>
          <h2 className="text-2xl font-bold heading-font mb-4 text-red-600">Active Jobs</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {pendingJobs.map(job => (
              <Card key={job.id} className="bg-zinc-900 border-zinc-800 card-hover">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg heading-font">{job.customer_name}</CardTitle>
                      <CardDescription className="text-gray-400 mt-1">
                        {job.car_brand} {job.car_model} ({job.year})
                      </CardDescription>
                    </div>
                    {getStatusBadge(job.status, job)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Reg No:</span>
                      <span className="font-mono">{job.registration_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Contact:</span>
                      <span>{job.contact_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Delivery:</span>
                      <span>{new Date(job.estimated_delivery).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800 p-3 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">Work Description</div>
                    <div className="text-sm">{job.work_description}</div>
                  </div>

                  {job.notes && (
                    <div className="bg-blue-900/20 border border-blue-800 p-3 rounded-lg">
                      <div className="text-xs text-blue-400 mb-1">Notes</div>
                      <div className="text-sm">{job.notes}</div>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {/* Status Change Button - Always Available */}
                    <Button
                      onClick={() => {
                        setStatusChangingJob(job);
                        setShowStatusDialog(true);
                      }}
                      variant="outline"
                      className="flex-1 border-zinc-700 hover:bg-zinc-800 text-sm"
                      data-testid={`change-status-${job.id}`}
                    >
                      Change Status
                    </Button>
                    
                    {job.status === "In Progress" && (
                      <Button
                        onClick={() => setSelectedJob(job)}
                        variant="outline"
                        className="border-zinc-700 hover:bg-zinc-800 text-sm"
                        data-testid={`add-notes-${job.id}`}
                      >
                        Add Notes
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {pendingJobs.length === 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="py-12">
                <div className="text-center text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg">No active jobs at the moment</p>
                  <p className="text-sm mt-2">Great work! All caught up.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Completed Jobs */}
        {completedJobs.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold heading-font mb-4 text-green-600">Completed Jobs</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {completedJobs.map(job => (
                <Card key={job.id} className="bg-zinc-900 border-zinc-800 opacity-75">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg heading-font">{job.customer_name}</CardTitle>
                        <CardDescription className="text-gray-400 mt-1">
                          {job.car_brand} {job.car_model} ({job.year})
                        </CardDescription>
                      </div>
                      {getStatusBadge(job.status, job)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Reg No:</span>
                        <span className="font-mono">{job.registration_number}</span>
                      </div>
                      {job.completion_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Completed:</span>
                          <span>{new Date(job.completion_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Status Change Dialog */}
      {statusChangingJob && (
        <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl heading-font">Change Status</DialogTitle>
              <DialogDescription className="text-gray-400">
                {statusChangingJob.customer_name} - {statusChangingJob.car_model}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {["Car Received", "Diagnosis Done", "Quotation sent", "Customer Confirmed", "Parts ordered", "In Progress", "Pending", "Work complete", "Washed", "Ready for delivery", "Delivered"].map((status) => (
                <Button
                  key={status}
                  onClick={async () => {
                    await handleStatusUpdate(statusChangingJob.id, status);
                    setShowStatusDialog(false);
                    setStatusChangingJob(null);
                  }}
                  className={`w-full justify-start ${statusChangingJob.status === status ? 'bg-red-600' : 'bg-zinc-800 hover:bg-zinc-700'}`}
                  variant={statusChangingJob.status === status ? "default" : "outline"}
                >
                  {status} {statusChangingJob.status === status && "✓"}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Notes Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setSelectedJob(null)}>
          <Card className="bg-zinc-900 border-zinc-800 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="heading-font">Add Notes</CardTitle>
              <CardDescription className="text-gray-400">
                {selectedJob.customer_name} - {selectedJob.car_model}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Job Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any updates, observations, or issues..."
                  rows={5}
                  className="bg-zinc-800 border-zinc-700"
                  data-testid="notes-textarea"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleAddNotes(selectedJob.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  data-testid="submit-notes"
                >
                  Save Notes
                </Button>
                <Button
                  onClick={() => {
                    setSelectedJob(null);
                    setNotes("");
                  }}
                  variant="outline"
                  className="border-zinc-700 hover:bg-zinc-800"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MechanicDashboard;
