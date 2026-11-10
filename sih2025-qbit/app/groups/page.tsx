"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import axios from "axios"
import Navbar from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, Users2, Trash2, Edit3, Loader2, AlertCircle, Eye } from "lucide-react"
import { Separator } from "@/components/ui/separator"

// Base API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

// Interfaces
interface MemberExpense {
  expense_id: string
  description: string
  amount_owed: number
  paid_by: string
  date: string
}

interface Member {
  id: string
  name: string
  personal_budget: number
  remaining_budget: number
  preferences: Record<string, boolean>
  activities: string[]
  expenses: MemberExpense[]
  payments: Record<string, boolean>
}

interface Expense {
  id: string
  amount: number
  description: string
  paid_by: string // member_id
  splits: Record<string, number> // member_id: amount_owed
  date: string
  status: 'pending' | 'settled' | 'verified' | 'rejected'
}

interface Activity {
  id: string
  name: string
  cost: number
  participants: string[]
  activity_type: string
  date: string
  status: 'planned' | 'completed' | 'cancelled'
}

interface Group {
  id: string
  name: string
  total_budget: number
  remaining_budget: number
  total_spent: number
  leader_id: string
  members: Member[]
  expenses: Expense[]
  activities: Activity[]
}

type CreateGroupFormData = {
  name: string
  total_budget: number
  leader_id: string
}

type AddMemberFormData = {
  name: string
  personal_budget: number
}

type AddExpenseFormData = {
  description: string
  amount: number
  paid_by: string // member_id
  split_type: "equal" // Initially just equal
}

export default function GroupExpensesPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserLeaderId, setCurrentUserLeaderId] = useState<string>("") // For creating groups

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)

  const createGroupForm = useForm<CreateGroupFormData>()
  const addMemberForm = useForm<AddMemberFormData>()
  const addExpenseForm = useForm<AddExpenseFormData>()

  // Fetch all groups
  const fetchGroups = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`${API_BASE_URL}/groups`)
      if (response.data.status === "success") {
        setGroups(response.data.data || [])
      } else {
        setError(response.data.message || "Failed to fetch groups")
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "An error occurred while fetching groups")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  const handleCreateGroup = async (data: CreateGroupFormData) => {
    if (!currentUserLeaderId) {
      setError("Please set your User ID to act as group leader.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await axios.post(`${API_BASE_URL}/groups`, { ...data, leader_id: currentUserLeaderId })
      if (response.data.status === "success") {
        setGroups(prev => [...prev, response.data.group_data])
        setIsCreateGroupOpen(false)
        createGroupForm.reset()
      } else {
        setError(response.data.message || "Failed to create group")
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "An error occurred while creating group")
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (data: AddMemberFormData) => {
    if (!selectedGroup) return
    setLoading(true)
    setError(null)
    try {
      const response = await axios.post(`${API_BASE_URL}/groups/${selectedGroup.id}/members`, data)
      if (response.data.status === "success") {
        // Refresh selected group or update locally
        fetchGroupDetails(selectedGroup.id) // Re-fetch to get updated member list
        setIsAddMemberOpen(false)
        addMemberForm.reset()
      } else {
        setError(response.data.message || "Failed to add member")
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "An error occurred while adding member")
    } finally {
      setLoading(false)
    }
  }

  const handleAddExpense = async (data: AddExpenseFormData) => {
    if (!selectedGroup) return
    setLoading(true)
    setError(null)
    try {
      const response = await axios.post(`${API_BASE_URL}/groups/${selectedGroup.id}/expenses`, {
        ...data,
        split_type: "equal", // For now
      })
      if (response.data.status === "success") {
        fetchGroupDetails(selectedGroup.id) // Re-fetch to get updated expenses
        setIsAddExpenseOpen(false)
        addExpenseForm.reset()
      } else {
        setError(response.data.message || "Failed to add expense")
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "An error occurred while adding expense")
    } finally {
      setLoading(false)
    }
  }

  const fetchGroupDetails = async (groupId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`${API_BASE_URL}/groups/${groupId}/summary`)
      if (response.data.status === "success") {
        setSelectedGroup(response.data.data)
        // Update the group in the main list as well
        setGroups(prevGroups => prevGroups.map(g => g.id === groupId ? response.data.data : g));
      } else {
        setError(response.data.message || "Failed to fetch group details")
        setSelectedGroup(null)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "An error occurred")
      setSelectedGroup(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group?")) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.delete(`${API_BASE_URL}/groups/${groupId}`);
      if (response.data.status === "success") {
        setGroups(prev => prev.filter(g => g.id !== groupId));
        if (selectedGroup?.id === groupId) {
          setSelectedGroup(null);
        }
      } else {
        setError(response.data.message || "Failed to delete group");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "An error occurred while deleting group");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (groupId: string, memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.delete(`${API_BASE_URL}/groups/${groupId}/members/${memberId}`);
      if (response.data.status === "success") {
        fetchGroupDetails(groupId); // Refresh group details
      } else {
        setError(response.data.message || "Failed to remove member");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "An error occurred while removing member");
    } finally {
      setLoading(false);
    }
  };


  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } },
    exit: { y: -20, opacity: 0 },
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-lime-100">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-lime-800">Group Expense Splitter</h1>
            <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
              <DialogTrigger asChild>
                <Button className="bg-lime-600 hover:bg-lime-700">
                  <PlusCircle className="mr-2 h-4 w-4" /> Create New Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a New Group</DialogTitle>
                  <DialogDescription>Enter details for your new travel group.</DialogDescription>
                </DialogHeader>
                <form onSubmit={createGroupForm.handleSubmit(handleCreateGroup)} className="space-y-4">
                  <div>
                    <Label htmlFor="leaderId">Your User ID (as Leader)</Label>
                    <Input
                      id="leaderId"
                      placeholder="Enter your user ID"
                      value={currentUserLeaderId}
                      onChange={(e) => setCurrentUserLeaderId(e.target.value)}
                      required
                    />
                     <p className="text-xs text-gray-500 mt-1">This ID will be set as the group leader.</p>
                  </div>
                  <div>
                    <Label htmlFor="groupName">Group Name</Label>
                    <Input id="groupName" {...createGroupForm.register("name", { required: true })} placeholder="e.g., Bali Adventure 2024" />
                  </div>
                  <div>
                    <Label htmlFor="totalBudget">Total Group Budget</Label>
                    <Input id="totalBudget" type="number" {...createGroupForm.register("total_budget", { required: true, valueAsNumber: true })} placeholder="e.g., 5000" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateGroupOpen(false)}>Cancel</Button>
                    <Button type="submit" className="bg-lime-600 hover:bg-lime-700" disabled={loading || !currentUserLeaderId}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create Group
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {error && (
          <motion.div
            variants={itemVariants} initial="hidden" animate="visible" exit="exit"
            className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center"
          >
            <AlertCircle className="h-5 w-5 mr-2" /> {error}
          </motion.div>
        )}

        {loading && !groups.length && (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-lime-600" />
                <p className="ml-2 text-lime-700">Loading groups...</p>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Groups List */}
          <div className="md:col-span-1">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lime-700">Your Groups</CardTitle>
              </CardHeader>
              <CardContent>
                {groups.length === 0 && !loading ? (
                  <p className="text-gray-500">No groups created yet. Start by creating one!</p>
                ) : (
                  <ul className="space-y-2">
                    {groups.map(group => (
                      <li key={group.id}>
                        <Button
                          variant="ghost"
                          className={`w-full justify-start text-left ${selectedGroup?.id === group.id ? 'bg-lime-100 text-lime-800' : ''}`}
                          onClick={() => fetchGroupDetails(group.id)}
                        >
                          <Users2 className="mr-2 h-4 w-4" /> {group.name}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Selected Group Details */}
          <div className="md:col-span-2">
            <AnimatePresence mode="wait">
              {selectedGroup ? (
                <motion.div key={selectedGroup.id} variants={itemVariants} initial="hidden" animate="visible" exit="exit">
                  <Card className="shadow-lg">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-2xl text-lime-800">{selectedGroup.name}</CardTitle>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteGroup(selectedGroup.id)} disabled={loading}>
                            <Trash2 className="h-4 w-4 mr-1" /> Delete Group
                        </Button>
                      </div>
                      <CardDescription>Leader ID: {selectedGroup.leader_id}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                        <div>
                          <p className="text-xs text-gray-500">Total Budget</p>
                          <p className="text-lg font-semibold text-lime-700">₹{selectedGroup.total_budget.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Spent</p>
                          <p className="text-lg font-semibold text-orange-600">₹{selectedGroup.total_spent.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Remaining</p>
                          <p className="text-lg font-semibold text-green-600">₹{selectedGroup.remaining_budget.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <Separator className="my-6" />

                      <Accordion type="multiple" className="w-full">
                        {/* Members Section */}
                        <AccordionItem value="members">
                        <AccordionTrigger className="text-lg font-medium text-lime-700">
                            Members ({selectedGroup.members.length})
                        </AccordionTrigger>
                          <AccordionContent>
                            <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="mb-4 border-lime-300 text-lime-700 hover:bg-lime-50">
                                  <PlusCircle className="mr-2 h-4 w-4" /> Add Member
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Add New Member</DialogTitle></DialogHeader>
                                <form onSubmit={addMemberForm.handleSubmit(handleAddMember)} className="space-y-4">
                                  <div><Label>Name</Label><Input {...addMemberForm.register("name", { required: true })} /></div>
                                  <div><Label>Personal Budget</Label><Input type="number" {...addMemberForm.register("personal_budget", { required: true, valueAsNumber: true })} /></div>
                                  <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsAddMemberOpen(false)}>Cancel</Button>
                                    <Button type="submit" className="bg-lime-600 hover:bg-lime-700" disabled={loading}>Add Member</Button>
                                  </DialogFooter>
                                </form>
                              </DialogContent>
                            </Dialog>
                            {selectedGroup.members.length > 0 ? (
                              <Table>
                                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Budget</TableHead><TableHead>Remaining</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                  {selectedGroup.members.map(member => (
                                    <TableRow key={member.id}>
                                      <TableCell>{member.name}</TableCell>
                                      <TableCell>₹{member.personal_budget.toFixed(2)}</TableCell>
                                      <TableCell>₹{member.remaining_budget.toFixed(2)}</TableCell>
                                      <TableCell>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteMember(selectedGroup.id, member.id)} disabled={loading}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : <p className="text-sm text-gray-500">No members yet.</p>}
                          </AccordionContent>
                        </AccordionItem>

                        {/* Expenses Section */}
                        <AccordionItem value="expenses">
                          <AccordionTrigger className="text-lg font-medium text-lime-700">Expenses ({selectedGroup.expenses.length})</AccordionTrigger>
                          <AccordionContent>
                            <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="mb-4 border-lime-300 text-lime-700 hover:bg-lime-50" disabled={selectedGroup.members.length === 0}>
                                  <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Add New Expense</DialogTitle></DialogHeader>
                                <form onSubmit={addExpenseForm.handleSubmit(handleAddExpense)} className="space-y-4">
                                  <div><Label>Description</Label><Input {...addExpenseForm.register("description", { required: true })} /></div>
                                  <div><Label>Amount</Label><Input type="number" {...addExpenseForm.register("amount", { required: true, valueAsNumber: true })} /></div>
                                  <div>
                                    <Label>Paid By</Label>
                                    <Controller
                                      name="paid_by"
                                      control={addExpenseForm.control}
                                      rules={{ required: "Payer is required" }}
                                      render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <SelectTrigger><SelectValue placeholder="Select who paid" /></SelectTrigger>
                                          <SelectContent>
                                            {selectedGroup.members.map(member => (
                                              <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    />
                                  </div>
                                  {/* Split type selection can be added here later */}
                                  <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsAddExpenseOpen(false)}>Cancel</Button>
                                    <Button type="submit" className="bg-lime-600 hover:bg-lime-700" disabled={loading}>Add Expense</Button>
                                  </DialogFooter>
                                </form>
                              </DialogContent>
                            </Dialog>
                             {selectedGroup.members.length === 0 && <p className="text-sm text-orange-600 mb-2">Add members to the group before adding expenses.</p>}
                            {selectedGroup.expenses.length > 0 ? (
                              <Table>
                                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead>Paid By</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                                <TableBody>
                                  {selectedGroup.expenses.map(expense => (
                                    <TableRow key={expense.id}>
                                      <TableCell>{expense.description}</TableCell>
                                      <TableCell>₹{expense.amount.toFixed(2)}</TableCell>
                                      <TableCell>{selectedGroup.members.find(m => m.id === expense.paid_by)?.name || 'Unknown'}</TableCell>
                                      <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                                      <TableCell>{expense.status}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : <p className="text-sm text-gray-500">No expenses recorded yet.</p>}
                          </AccordionContent>
                        </AccordionItem>
                        {/* Activities, Preferences, Recommendations can be added similarly */}
                      </Accordion>

                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div key="no-selection" variants={itemVariants} initial="hidden" animate="visible" exit="exit"
                  className="flex flex-col items-center justify-center h-full p-8 bg-white rounded-lg shadow-md"
                >
                  <Users2 className="h-16 w-16 text-lime-300 mb-4" />
                  <p className="text-xl text-lime-700">Select a group to view details</p>
                  <p className="text-sm text-gray-500">or create a new group to get started.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
