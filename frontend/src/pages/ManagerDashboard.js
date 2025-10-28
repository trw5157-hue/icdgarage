import { useState, useEffect } from "react";
import { useAuth } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function to download PDF with authentication
const downloadPDFWithAuth = async (invoiceId, invoiceNumber) => {
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error("Authentication required");
    return;
  }

  try {
    const response = await fetch(`${API}/invoices/${invoiceId}/pdf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success("PDF downloaded successfully!");
    return true;
  } catch (error) {
    console.error('PDF download error:', error);
    toast.error("Failed to download PDF");
    return false;
  }
};

// Helper function to view PDF in new window with authentication
const viewPDFWithAuth = async (invoiceId, invoiceNumber) => {
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error("Authentication required");
    return;
  }

  try {
    const response = await fetch(`${API}/invoices/${invoiceId}/pdf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    // Open in new window
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      newWindow.document.title = invoiceNumber;
      toast.success("PDF opened in new tab");
    } else {
      toast.error("Popup blocked. Please allow popups for this site.");
    }
    
    return true;
  } catch (error) {
    console.error('PDF view error:', error);
    toast.error("Failed to open PDF");
    return false;
  }
};

const ManagerDashboard = () => {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewJobDialog, setShowNewJobDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusChangingJob, setStatusChangingJob] = useState(null);
  const [activeTab, setActiveTab] = useState("jobs"); // jobs or invoices
  const [invoices, setInvoices] = useState([]);

  // New Job Form
  const [newJob, setNewJob] = useState({
    customer_name: "",
    contact_number: "",
    car_brand: "",
    car_model: "",
    year: new Date().getFullYear(),
    registration_number: "",
    vin: "",
    kms: "",
    entry_date: new Date().toISOString().split('T')[0],
    work_description: "",
    estimated_delivery: "",
    assigned_mechanic_id: ""
  });

  // Invoice Form
  const [invoice, setInvoice] = useState({
    labour_charges: 0,
    parts: [{ part_name: "", part_charges: 0 }],  // Array of parts
    tuning_charges: 0,
    others_charges: 0,
    gst_rate: 18,
    invoice_number: "",
    invoice_date: ""
  });

  useEffect(() => {
    fetchJobs();
    fetchMechanics();
    if (activeTab === "invoices") {
      fetchInvoices();
    }
  }, [activeTab]);

  const fetchInvoices = async () => {
    try {
      // Fetch all jobs and their invoices
      const jobsResponse = await axios.get(`${API}/jobs`);
      const allJobs = jobsResponse.data;
      
      // For each job, try to fetch its invoice
      const invoicePromises = allJobs.map(async (job) => {
        try {
          const response = await axios.get(`${API}/invoices/job/${job.id}`);
          if (response.data && response.data.length > 0) {
            return { job, invoice: response.data[0] };
          }
          return null;
        } catch {
          return null;
        }
      });
      
      const results = await Promise.all(invoicePromises);
      const validInvoices = results.filter(r => r !== null);
      setInvoices(validInvoices);
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API}/jobs`);
      setJobs(response.data);
    } catch (error) {
      toast.error("Failed to fetch jobs");
    }
  };

  const fetchMechanics = async () => {
    try {
      const response = await axios.get(`${API}/mechanics`);
      setMechanics(response.data);
    } catch (error) {
      toast.error("Failed to fetch mechanics");
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const jobData = {
        ...newJob,
        year: parseInt(newJob.year),
        kms: newJob.kms ? parseInt(newJob.kms) : null,
        entry_date: new Date(newJob.entry_date).toISOString(),
        estimated_delivery: new Date(newJob.estimated_delivery).toISOString()
      };
      await axios.post(`${API}/jobs`, jobData);
      toast.success("Job created successfully!");
      setShowNewJobDialog(false);
      fetchJobs();
      setNewJob({
        customer_name: "",
        contact_number: "",
        car_brand: "",
        car_model: "",
        year: new Date().getFullYear(),
        registration_number: "",
        vin: "",
        kms: "",
        entry_date: new Date().toISOString().split('T')[0],
        work_description: "",
        estimated_delivery: "",
        assigned_mechanic_id: ""
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create job");
    } finally {
      setLoading(false);
    }
  };

  const handleSendConfirmation = async (job) => {
    try {
      await axios.post(`${API}/jobs/${job.id}/send-confirmation`);
      toast.success("WhatsApp confirmation sent (mocked)");
    } catch (error) {
      toast.error("Failed to send confirmation");
    }
  };

  const handleUpdateJob = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updateData = {
        ...editingJob,
        year: parseInt(editingJob.year),
        kms: parseInt(editingJob.kms),
        entry_date: new Date(editingJob.entry_date).toISOString(),
        estimated_delivery: new Date(editingJob.estimated_delivery).toISOString()
      };
      
      await axios.patch(`${API}/jobs/${editingJob.id}`, updateData);
      toast.success("Job updated successfully!");
      setShowEditDialog(false);
      setEditingJob(null);
      fetchJobs();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update job");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      await axios.patch(`${API}/jobs/${jobId}`, { status: newStatus });
      toast.success("Status updated successfully!");
      fetchJobs();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/invoices`, {
        job_id: selectedJob.id,
        ...invoice
      });
      toast.success("Invoice generated successfully!");
      
      // Download PDF with authentication
      await downloadPDFWithAuth(response.data.id, response.data.invoice_number);
      
      setShowInvoiceDialog(false);
      setSelectedJob(null);
      setInvoice({
        labour_charges: 0,
        parts: [{ part_name: "", part_charges: 0 }],
        tuning_charges: 0,
        others_charges: 0,
        gst_rate: 18,
        invoice_number: "",
        invoice_date: ""
      });
      
      // Refresh invoices if on invoices tab
      if (activeTab === "invoices") {
        fetchInvoices();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  };

  const handleExportToSheets = async () => {
    try {
      await axios.post(`${API}/export/google-sheets`);
      toast.success("Data exported to Google Sheets (mocked)");
    } catch (error) {
      toast.error("Failed to export data");
    }
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

  const filteredJobs = jobs.filter(job => {
    const matchesStatus = filterStatus === "All" || job.status === filterStatus;
    const matchesSearch = job.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.car_model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.registration_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Parts management functions
  const addPart = () => {
    setInvoice({
      ...invoice,
      parts: [...invoice.parts, { part_name: "", part_charges: 0 }]
    });
  };

  const removePart = (index) => {
    const newParts = invoice.parts.filter((_, i) => i !== index);
    setInvoice({
      ...invoice,
      parts: newParts.length > 0 ? newParts : [{ part_name: "", part_charges: 0 }]
    });
  };

  const updatePart = (index, field, value) => {
    const newParts = [...invoice.parts];
    newParts[index][field] = field === 'part_charges' ? (parseFloat(value) || 0) : value;
    setInvoice({
      ...invoice,
      parts: newParts
    });
  };

  const parts_total = invoice.parts.reduce((sum, part) => sum + (part.part_charges || 0), 0);
  const subtotal = invoice.labour_charges + parts_total + invoice.tuning_charges + invoice.others_charges;
  const gst = subtotal * ((invoice.gst_rate || 0) / 100);
  const grandTotal = subtotal + gst;

  return (
    <div className="min-h-screen bg-black text-white" data-testid="manager-dashboard">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 md:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 md:space-x-4">
            <img 
              src={process.env.REACT_APP_LOGO_URL} 
              alt="ICD Tuning" 
              className="h-14 md:h-16 w-auto"
            />
            <div>
              <h1 className="text-xl md:text-2xl font-bold heading-font text-red-600">ICD TUNING</h1>
              <p className="text-xs md:text-sm text-gray-400">Manager Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <span className="text-xs md:text-sm text-gray-400 hidden sm:block">Welcome, {user?.full_name}</span>
            <Button 
              onClick={logout} 
              variant="outline" 
              size="sm"
              className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white text-xs md:text-sm"
              data-testid="logout-button"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-zinc-800">
            <TabsTrigger value="jobs" data-testid="jobs-tab" className="text-sm">Jobs</TabsTrigger>
            <TabsTrigger value="invoices" data-testid="invoices-tab" className="text-sm">Invoices</TabsTrigger>
          </TabsList>
          
          <TabsContent value="jobs" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
        {/* Actions Bar */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <Dialog open={showNewJobDialog} onOpenChange={setShowNewJobDialog}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700 btn-hover-lift" data-testid="new-job-button">
                + New Job Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl heading-font">Add New Job</DialogTitle>
                <DialogDescription className="text-gray-400">Enter customer and vehicle details</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateJob} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Name *</Label>
                    <Input
                      data-testid="new-job-customer-name"
                      value={newJob.customer_name}
                      onChange={(e) => setNewJob({...newJob, customer_name: e.target.value})}
                      required
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Number *</Label>
                    <Input
                      data-testid="new-job-contact"
                      value={newJob.contact_number}
                      onChange={(e) => setNewJob({...newJob, contact_number: e.target.value})}
                      required
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Car Brand *</Label>
                    <Select value={newJob.car_brand} onValueChange={(v) => setNewJob({...newJob, car_brand: v})}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700">
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="Mercedes-Benz">Mercedes-Benz</SelectItem>
                        <SelectItem value="BMW">BMW</SelectItem>
                        <SelectItem value="Audi">Audi</SelectItem>
                        <SelectItem value="Volkswagen">Volkswagen</SelectItem>
                        <SelectItem value="Porsche">Porsche</SelectItem>
                        <SelectItem value="Opel">Opel</SelectItem>
                        <SelectItem value="Volvo">Volvo</SelectItem>
                        <SelectItem value="Hyundai">Hyundai</SelectItem>
                        <SelectItem value="Suzuki">Suzuki</SelectItem>
                        <SelectItem value="Honda">Honda</SelectItem>
                        <SelectItem value="Toyota">Toyota</SelectItem>
                        <SelectItem value="Mahindra">Mahindra</SelectItem>
                        <SelectItem value="Tata">Tata</SelectItem>
                        <SelectItem value="Nissan">Nissan</SelectItem>
                        <SelectItem value="Ford">Ford</SelectItem>
                        <SelectItem value="Chevrolet">Chevrolet</SelectItem>
                        <SelectItem value="Renault">Renault</SelectItem>
                        <SelectItem value="Peugeot">Peugeot</SelectItem>
                        <SelectItem value="Skoda">Skoda</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Car Model *</Label>
                    <Input
                      data-testid="new-job-model"
                      value={newJob.car_model}
                      onChange={(e) => setNewJob({...newJob, car_model: e.target.value})}
                      required
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Year *</Label>
                    <Input
                      type="number"
                      value={newJob.year}
                      onChange={(e) => setNewJob({...newJob, year: e.target.value})}
                      required
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Registration Number *</Label>
                    <Input
                      data-testid="new-job-reg-number"
                      value={newJob.registration_number}
                      onChange={(e) => setNewJob({...newJob, registration_number: e.target.value})}
                      required
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>VIN *</Label>
                    <Input
                      value={newJob.vin}
                      onChange={(e) => setNewJob({...newJob, vin: e.target.value})}
                      required
                      className="bg-zinc-800 border-zinc-700"
                      placeholder="Vehicle Identification Number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Odometer (KMs) *</Label>
                    <Input
                      type="number"
                      value={newJob.kms}
                      onChange={(e) => setNewJob({...newJob, kms: e.target.value})}
                      required
                      className="bg-zinc-800 border-zinc-700"
                      placeholder="Current mileage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Entry Date *</Label>
                    <Input
                      type="date"
                      value={newJob.entry_date}
                      onChange={(e) => setNewJob({...newJob, entry_date: e.target.value})}
                      required
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Delivery *</Label>
                    <Input
                      type="date"
                      value={newJob.estimated_delivery}
                      onChange={(e) => setNewJob({...newJob, estimated_delivery: e.target.value})}
                      required
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assigned Mechanic *</Label>
                  <Select value={newJob.assigned_mechanic_id} onValueChange={(v) => setNewJob({...newJob, assigned_mechanic_id: v})}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="Select mechanic" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {mechanics.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work Description *</Label>
                  <Textarea
                    data-testid="new-job-work-description"
                    value={newJob.work_description}
                    onChange={(e) => setNewJob({...newJob, work_description: e.target.value})}
                    required
                    rows={4}
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={loading} data-testid="submit-new-job">
                  {loading ? "Creating..." : "Create Job"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button 
            onClick={handleExportToSheets} 
            variant="outline" 
            className="border-zinc-700 hover:bg-zinc-800"
            data-testid="export-sheets-button"
          >
            Export to Google Sheets
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search by customer, car, or registration..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-800 border-zinc-700"
                  data-testid="search-jobs-input"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[200px] bg-zinc-800 border-zinc-700" data-testid="filter-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Car Received">Car Received</SelectItem>
                  <SelectItem value="Diagnosis Done">Diagnosis Done</SelectItem>
                  <SelectItem value="Quotation sent">Quotation sent</SelectItem>
                  <SelectItem value="Customer Confirmed">Customer Confirmed</SelectItem>
                  <SelectItem value="Parts ordered">Parts ordered</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Work complete">Work complete</SelectItem>
                  <SelectItem value="Washed">Washed</SelectItem>
                  <SelectItem value="Ready for delivery">Ready for delivery</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Table */}
        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
          <CardHeader>
            <CardTitle className="heading-font text-lg md:text-xl">All Jobs ({filteredJobs.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-zinc-800 text-left">
                    <th className="pb-3 px-4 md:px-6 text-gray-400 font-medium text-sm">Customer</th>
                    <th className="pb-3 px-4 md:px-6 text-gray-400 font-medium text-sm">Vehicle</th>
                    <th className="pb-3 px-4 md:px-6 text-gray-400 font-medium text-sm">Reg No.</th>
                    <th className="pb-3 px-4 md:px-6 text-gray-400 font-medium text-sm hidden md:table-cell">Mechanic</th>
                    <th className="pb-3 px-4 md:px-6 text-gray-400 font-medium text-sm">Status</th>
                    <th className="pb-3 px-4 md:px-6 text-gray-400 font-medium text-sm hidden lg:table-cell">Delivery</th>
                    <th className="pb-3 px-4 md:px-6 text-gray-400 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map(job => {
                    const statusClasses = {
                      "Car Received": "bg-gray-500/10",
                      "Diagnosis Done": "bg-yellow-500/10",
                      "Quotation sent": "bg-yellow-500/10",
                      "Customer Confirmed": "bg-orange-500/10",
                      "Parts ordered": "bg-orange-500/10",
                      "In Progress": "bg-orange-500/10",
                      "Pending": "bg-red-500/10",
                      "Work complete": "bg-blue-500/10",
                      "Washed": "bg-blue-500/10",
                      "Ready for delivery": "bg-purple-500/10",
                      "Delivered": "bg-green-500/10"
                    };
                    return (
                    <tr key={job.id} className={`border-b border-zinc-800 hover:bg-zinc-800/50 ${statusClasses[job.status] || ''}`}>
                      <td className="py-4 px-4 md:px-6">
                        <div>
                          <div className="font-medium text-sm">{job.customer_name}</div>
                          <div className="text-xs text-gray-400">{job.contact_number}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4 md:px-6">
                        <div>
                          <div className="font-medium text-sm">{job.car_brand} {job.car_model}</div>
                          <div className="text-xs text-gray-400">{job.year}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4 md:px-6 font-mono text-xs md:text-sm">{job.registration_number}</td>
                      <td className="py-4 px-4 md:px-6 text-sm hidden md:table-cell">{job.assigned_mechanic_name}</td>
                      <td className="py-4 px-4 md:px-6">{getStatusBadge(job.status, job)}</td>
                      <td className="py-4 px-4 md:px-6 text-xs hidden lg:table-cell">{new Date(job.estimated_delivery).toLocaleDateString()}</td>
                      <td className="py-4 px-4 md:px-6">
                        <div className="flex gap-1 md:gap-2 flex-wrap">
                          {/* Edit Button - Always visible */}
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingJob({
                                ...job,
                                entry_date: new Date(job.entry_date).toISOString().split('T')[0],
                                estimated_delivery: new Date(job.estimated_delivery).toISOString().split('T')[0]
                              });
                              setShowEditDialog(true);
                            }}
                            variant="outline"
                            className="border-zinc-700 hover:bg-zinc-800 text-xs"
                            data-testid={`edit-job-${job.id}`}
                          >
                            Edit
                          </Button>
                          
                          {/* WhatsApp Button - Always visible */}
                          <Button
                            size="sm"
                            onClick={() => handleSendConfirmation(job)}
                            className="bg-green-600 hover:bg-green-700 text-xs"
                            data-testid={`send-whatsapp-${job.id}`}
                          >
                            WhatsApp
                          </Button>
                          
                          {/* Invoice Button - For completed statuses */}
                          {["Work complete", "Washed", "Ready for delivery", "Delivered"].includes(job.status) && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedJob(job);
                                setShowInvoiceDialog(true);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-xs"
                              data-testid={`generate-invoice-${job.id}`}
                            >
                              Invoice
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              {filteredJobs.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No jobs found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
          </TabsContent>
          
          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <div></div>
              <Button 
                onClick={() => setShowInvoiceDialog(true)}
                className="bg-red-600 hover:bg-red-700"
                data-testid="create-invoice-button"
              >
                + Create Invoice
              </Button>
            </div>
            
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="heading-font">All Invoices ({invoices.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 md:p-6">
                <div className="overflow-x-auto -mx-6 md:mx-0">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b border-zinc-800 text-left">
                        <th className="pb-3 px-4 md:px-2 text-gray-400 font-medium text-sm">Invoice No.</th>
                        <th className="pb-3 px-4 md:px-2 text-gray-400 font-medium text-sm">Customer</th>
                        <th className="pb-3 px-4 md:px-2 text-gray-400 font-medium text-sm hidden md:table-cell">Vehicle</th>
                        <th className="pb-3 px-4 md:px-2 text-gray-400 font-medium text-sm hidden lg:table-cell">Date</th>
                        <th className="pb-3 px-4 md:px-2 text-gray-400 font-medium text-sm">Amount</th>
                        <th className="pb-3 px-4 md:px-2 text-gray-400 font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(({ job, invoice }) => (
                        <tr key={invoice.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                          <td className="py-4 px-4 md:px-2 font-mono text-xs md:text-sm">{invoice.invoice_number}</td>
                          <td className="py-4 px-4 md:px-2 text-sm">
                            <div>
                              <div className="font-medium">{job.customer_name}</div>
                              <div className="text-sm text-gray-400">{job.contact_number}</div>
                            </div>
                          </td>
                          <td className="py-4">
                            <div>
                              <div className="font-medium">{job.car_brand} {job.car_model}</div>
                              <div className="text-sm text-gray-400">{job.registration_number}</div>
                            </div>
                          </td>
                          <td className="py-4 text-sm">{new Date(invoice.invoice_date).toLocaleDateString()}</td>
                          <td className="py-4 font-semibold text-green-500">₹{invoice.grand_total.toFixed(2)}</td>
                          <td className="py-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => downloadPDFWithAuth(invoice.id, invoice.invoice_number)}
                                className="bg-blue-600 hover:bg-blue-700 text-xs"
                                data-testid={`download-invoice-${invoice.id}`}
                              >
                                Download PDF
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => viewPDFWithAuth(invoice.id, invoice.invoice_number)}
                                variant="outline"
                                className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white text-xs"
                                data-testid={`view-invoice-${invoice.id}`}
                              >
                                View PDF
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSendConfirmation(job)}
                                className="bg-green-600 hover:bg-green-700 text-xs"
                              >
                                Send WhatsApp
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {invoices.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      No invoices generated yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
                    await handleStatusChange(statusChangingJob.id, status);
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

      {/* Edit Job Dialog */}
      {editingJob && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl heading-font">Edit Job</DialogTitle>
              <DialogDescription className="text-gray-400">
                Update job details and status
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateJob} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input
                    value={editingJob.customer_name}
                    onChange={(e) => setEditingJob({...editingJob, customer_name: e.target.value})}
                    required
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Number *</Label>
                  <Input
                    value={editingJob.contact_number}
                    onChange={(e) => setEditingJob({...editingJob, contact_number: e.target.value})}
                    required
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Car Brand *</Label>
                  <Select value={editingJob.car_brand} onValueChange={(v) => setEditingJob({...editingJob, car_brand: v})}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="Mercedes-Benz">Mercedes-Benz</SelectItem>
                      <SelectItem value="BMW">BMW</SelectItem>
                      <SelectItem value="Audi">Audi</SelectItem>
                      <SelectItem value="Volkswagen">Volkswagen</SelectItem>
                      <SelectItem value="Porsche">Porsche</SelectItem>
                      <SelectItem value="Opel">Opel</SelectItem>
                      <SelectItem value="Volvo">Volvo</SelectItem>
                      <SelectItem value="Hyundai">Hyundai</SelectItem>
                      <SelectItem value="Suzuki">Suzuki</SelectItem>
                      <SelectItem value="Honda">Honda</SelectItem>
                      <SelectItem value="Toyota">Toyota</SelectItem>
                      <SelectItem value="Mahindra">Mahindra</SelectItem>
                      <SelectItem value="Tata">Tata</SelectItem>
                      <SelectItem value="Nissan">Nissan</SelectItem>
                      <SelectItem value="Ford">Ford</SelectItem>
                      <SelectItem value="Chevrolet">Chevrolet</SelectItem>
                      <SelectItem value="Renault">Renault</SelectItem>
                      <SelectItem value="Peugeot">Peugeot</SelectItem>
                      <SelectItem value="Skoda">Skoda</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Car Model *</Label>
                  <Input
                    value={editingJob.car_model}
                    onChange={(e) => setEditingJob({...editingJob, car_model: e.target.value})}
                    required
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Year *</Label>
                  <Input
                    type="number"
                    value={editingJob.year}
                    onChange={(e) => setEditingJob({...editingJob, year: e.target.value})}
                    required
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Registration Number *</Label>
                  <Input
                    value={editingJob.registration_number}
                    onChange={(e) => setEditingJob({...editingJob, registration_number: e.target.value})}
                    required
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>VIN *</Label>
                  <Input
                    value={editingJob.vin}
                    onChange={(e) => setEditingJob({...editingJob, vin: e.target.value})}
                    required
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Odometer (KMs) *</Label>
                  <Input
                    type="number"
                    value={editingJob.kms}
                    onChange={(e) => setEditingJob({...editingJob, kms: e.target.value})}
                    required
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Entry Date *</Label>
                  <Input
                    type="date"
                    value={editingJob.entry_date}
                    onChange={(e) => setEditingJob({...editingJob, entry_date: e.target.value})}
                    required
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estimated Delivery *</Label>
                  <Input
                    type="date"
                    value={editingJob.estimated_delivery}
                    onChange={(e) => setEditingJob({...editingJob, estimated_delivery: e.target.value})}
                    required
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status *</Label>
                  <Select value={editingJob.status} onValueChange={(v) => setEditingJob({...editingJob, status: v})}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="Car Received">Car Received</SelectItem>
                      <SelectItem value="Diagnosis Done">Diagnosis Done</SelectItem>
                      <SelectItem value="Quotation sent">Quotation sent</SelectItem>
                      <SelectItem value="Customer Confirmed">Customer Confirmed</SelectItem>
                      <SelectItem value="Parts ordered">Parts ordered</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Work complete">Work complete</SelectItem>
                      <SelectItem value="Washed">Washed</SelectItem>
                      <SelectItem value="Ready for delivery">Ready for delivery</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned Mechanic *</Label>
                  <Select value={editingJob.assigned_mechanic_id} onValueChange={(v) => {
                    const mechanic = mechanics.find(m => m.id === v);
                    setEditingJob({...editingJob, assigned_mechanic_id: v, assigned_mechanic_name: mechanic?.full_name || ''});
                  }}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {mechanics.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Work Description *</Label>
                <Textarea
                  value={editingJob.work_description}
                  onChange={(e) => setEditingJob({...editingJob, work_description: e.target.value})}
                  required
                  rows={4}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editingJob.notes || ''}
                  onChange={(e) => setEditingJob({...editingJob, notes: e.target.value})}
                  rows={3}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700" disabled={loading}>
                  {loading ? "Updating..." : "Update Job"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingJob(null);
                  }}
                  variant="outline"
                  className="border-zinc-700 hover:bg-zinc-800"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={(open) => {
        setShowInvoiceDialog(open);
        if (!open) {
          setSelectedJob(null);
          setInvoice({
            labour_charges: 0,
            parts: [{ part_name: "", part_charges: 0 }],
            tuning_charges: 0,
            others_charges: 0,
            gst_rate: 18,
            invoice_number: "",
            invoice_date: ""
          });
        }
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl heading-font">Generate Invoice</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedJob ? `${selectedJob.customer_name} - ${selectedJob.car_model}` : "Select a job to generate invoice"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGenerateInvoice} className="space-y-4 mt-4">
            {!selectedJob && (
              <div className="space-y-2">
                <Label>Select Job *</Label>
                <Select onValueChange={(jobId) => {
                  const job = jobs.find(j => j.id === jobId);
                  setSelectedJob(job);
                }}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue placeholder="Choose a completed job" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 max-h-60">
                    {jobs.filter(j => ["Work complete", "Washed", "Ready for delivery", "Delivered"].includes(j.status)).map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.customer_name} - {job.car_brand} {job.car_model} ({job.registration_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {selectedJob && (
              <>
                <div className="space-y-2">
                  <Label>Invoice Number (Optional)</Label>
                  <Input
                    type="text"
                    value={invoice.invoice_number}
                    onChange={(e) => setInvoice({...invoice, invoice_number: e.target.value})}
                    className="bg-zinc-800 border-zinc-700"
                    data-testid="invoice-number"
                    placeholder="Leave empty for auto-generation"
                  />
                  <p className="text-xs text-gray-500">Leave empty to auto-generate (ICD-2025-XXXX)</p>
                </div>
                <div className="space-y-2">
                  <Label>Invoice Date (Optional)</Label>
                  <Input
                    type="date"
                    value={invoice.invoice_date}
                    onChange={(e) => setInvoice({...invoice, invoice_date: e.target.value})}
                    className="bg-zinc-800 border-zinc-700"
                    data-testid="invoice-date"
                  />
                  <p className="text-xs text-gray-500">Leave empty to use today's date</p>
                </div>
                <div className="space-y-2">
                  <Label>Labour Charges (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={invoice.labour_charges}
                    onChange={(e) => setInvoice({...invoice, labour_charges: parseFloat(e.target.value) || 0})}
                    className="bg-zinc-800 border-zinc-700"
                    data-testid="invoice-labour-charges"
                    placeholder="0.00"
                  />
                </div>
                
                {/* Parts Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Parts</Label>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addPart}
                      className="bg-green-600 hover:bg-green-700 text-xs"
                      data-testid="add-part-button"
                    >
                      + Add Part
                    </Button>
                  </div>
                  {invoice.parts.map((part, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Input
                          type="text"
                          value={part.part_name}
                          onChange={(e) => updatePart(index, 'part_name', e.target.value)}
                          className="bg-zinc-800 border-zinc-700"
                          placeholder="Part name"
                          data-testid={`part-name-${index}`}
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={part.part_charges}
                          onChange={(e) => updatePart(index, 'part_charges', e.target.value)}
                          className="bg-zinc-800 border-zinc-700"
                          placeholder="0.00"
                          data-testid={`part-charges-${index}`}
                        />
                      </div>
                      {invoice.parts.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => removePart(index)}
                          variant="outline"
                          className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                          data-testid={`remove-part-${index}`}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="text-sm text-gray-400 flex justify-between">
                    <span>Parts Total:</span>
                    <span>₹{parts_total.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Tuning/Service Charges (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={invoice.tuning_charges}
                    onChange={(e) => setInvoice({...invoice, tuning_charges: parseFloat(e.target.value) || 0})}
                    className="bg-zinc-800 border-zinc-700"
                    data-testid="invoice-tuning-charges"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Other Charges (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={invoice.others_charges}
                    onChange={(e) => setInvoice({...invoice, others_charges: parseFloat(e.target.value) || 0})}
                    className="bg-zinc-800 border-zinc-700"
                    data-testid="invoice-others-charges"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>GST Rate (%) - Optional</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={invoice.gst_rate}
                    onChange={(e) => setInvoice({...invoice, gst_rate: parseFloat(e.target.value) || 0})}
                    className="bg-zinc-800 border-zinc-700"
                    data-testid="invoice-gst-rate"
                    placeholder="18.00"
                  />
                  <p className="text-xs text-gray-500">Set to 0 to exclude GST from invoice</p>
                </div>
                <div className="border-t border-zinc-700 pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subtotal:</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {invoice.gst_rate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">GST ({invoice.gst_rate}%):</span>
                      <span>₹{gst.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-red-600">
                    <span>Grand Total:</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={loading} data-testid="submit-invoice">
                  {loading ? "Generating..." : "Generate & Download PDF"}
                </Button>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerDashboard;