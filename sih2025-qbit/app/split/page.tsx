// app/devtracker/page.tsx
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button'; // Assuming you have these
import { Input } from '@/components/ui/input';     //  and they are styled
import { Label } from '@/components/ui/label';     //  to look modern.
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils" // Utility for combining class names

const API_BASE_URL = 'http://localhost:5000/api';

// --- TypeScript Interfaces ---
interface Member {
  id: string;
  name: string;
  personal_budget: number;
  remaining_budget: number;
  preferences: Record<string, boolean>;
  activities: string[];
  expenses: { expense_id: string; share: number; description: string }[];
  payments: Record<string, boolean>;
}

interface Expense {
  id: string;
  amount: number;
  description: string;
  paid_by: string;
  splits: Record<string, number>;
  date: string;
  status: string;
}

interface Activity {
  id: string;
  name: string;
  cost: number;
  participants: string[];
  activity_type: string;
  date: string;
  status: string;
}

interface Group {
  id: string;
  name: string;
  total_budget: number;
  remaining_budget: number;
  total_spent: number;
  leader_id: string;
  members: Member[];
  expenses: Expense[];
  activities: Activity[];
}

interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  group_id?: string;
  member_id?: string;
  expense_id?: string;
  activity_id?: string;
}

// --- Component ---
export default function DevTrackerPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'expenses' | 'activities'>('members');
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);

  // Form States
  const [groupName, setGroupName] = useState('');
  const [groupBudget, setGroupBudget] = useState('');

  const [memberName, setMemberName] = useState('');
  const [memberBudget, setMemberBudget] = useState('');

  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseSplitType, setExpenseSplitType] = useState('equal');

  const [activityName, setActivityName] = useState('');
  const [activityCost, setActivityCost] = useState('');
  const [activityType, setActivityType] = useState('Dining');

  const showAlert = (message: string, type: 'success' | 'danger') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups`);
      const result: ApiResponse<Group[]> = await response.json();
      if (result.status === 'success' && result.data) {
        setGroups(result.data);
      } else {
        showAlert(result.message || 'Failed to load groups', 'danger');
      }
    } catch (error) {
      showAlert('Error loading groups: ' + (error as Error).message, 'danger');
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // Optimistic Update
      const newGroupId = uuidv4();
      const newGroup = {
        id: newGroupId,
        name: groupName,
        total_budget: parseFloat(groupBudget),
        remaining_budget: parseFloat(groupBudget),
        total_spent: 0,
        leader_id: 'user_who_created_this',
        members: [],
        expenses: [],
        activities: [],
      };
      setGroups(prevGroups => [...prevGroups, newGroup]);

      const response = await fetch(`${API_BASE_URL}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          total_budget: parseFloat(groupBudget),
          leader_id: 'user_who_created_this',
        }),
      });
      const result: ApiResponse<Group> = await response.json();
      if (result.status === 'success') {
        showAlert('Group created successfully!', 'success');
        fetchGroups();
        setGroupName('');
        setGroupBudget('');
      } else {
        showAlert(result.message || 'Failed to create group', 'danger');
        setGroups(prevGroups => prevGroups.filter(group => group.id !== newGroupId));
      }
    } catch (error) {
      showAlert('Error creating group: ' + (error as Error).message, 'danger');
    }
  };

  const openGroupDetailsModal = async (groupId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/${groupId}/summary`);
      const result: ApiResponse<Group> = await response.json();
      if (result.status === 'success' && result.data) {
        setCurrentGroup(result.data);
        setIsModalOpen(true);
        setActiveTab('members');
      } else {
        showAlert(result.message || 'Failed to load group details', 'danger');
      }
    } catch (error) {
      showAlert('Error loading group details: ' + (error as Error).message, 'danger');
    }
  };

  const refreshCurrentGroupDetails = async () => {
    if (currentGroup) {
      await openGroupDetailsModal(currentGroup.id);
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;

    try {
      const newMemberId = uuidv4();
      const newMember = {
        id: newMemberId,
        name: memberName,
        personal_budget: parseFloat(memberBudget),
        remaining_budget: parseFloat(memberBudget),
        preferences: {},
        activities: [],
        expenses: [],
        payments: {},
      };
      setCurrentGroup(prevGroup =>
        prevGroup ? { ...prevGroup, members: [...prevGroup.members, newMember] } : null
      );

      const response = await fetch(`${API_BASE_URL}/groups/${currentGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: memberName, personal_budget: parseFloat(memberBudget) }),
      });
      const result: ApiResponse<Member> = await response.json();
      if (result.status === 'success') {
        showAlert('Member added successfully!', 'success');
        refreshCurrentGroupDetails();
        setMemberName('');
        setMemberBudget('');
      } else {
        showAlert(result.message || 'Failed to add member', 'danger');
        setCurrentGroup(prevGroup =>
          prevGroup ? { ...prevGroup, members: prevGroup.members.filter(m => m.id !== newMemberId) } : null
        );
      }
    } catch (error) {
      showAlert('Error adding member: ' + (error as Error).message, 'danger');
    }
  };

  const handleAddExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;

    const paid_by_user = currentGroup.members.length > 0 ? currentGroup.members[0].id : 'group_funds';

    try {
      const newExpenseId = uuidv4();
      const newExpense = {
        id: newExpenseId,
        amount: parseFloat(expenseAmount),
        description: expenseDescription,
        paid_by: paid_by_user,
        splits: {},
        date: new Date().toISOString(),
        status: 'pending',
      };
      setCurrentGroup(prevGroup =>
        prevGroup ? { ...prevGroup, expenses: [...prevGroup.expenses, newExpense] } : null
      );

      const response = await fetch(`${API_BASE_URL}/groups/${currentGroup.id}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: expenseDescription,
          amount: parseFloat(expenseAmount),
          split_type: expenseSplitType,
          paid_by: paid_by_user,
        }),
      });
      const result: ApiResponse<Expense> = await response.json();
      if (result.status === 'success') {
        showAlert('Expense added successfully!', 'success');
        refreshCurrentGroupDetails();
        setExpenseDescription('');
        setExpenseAmount('');
      } else {
        showAlert(result.message || 'Failed to add expense', 'danger');
        setCurrentGroup(prevGroup =>
          prevGroup ? { ...prevGroup, expenses: prevGroup.expenses.filter(exp => exp.id !== newExpenseId) } : null
        );
      }
    } catch (error) {
      showAlert('Error adding expense: ' + (error as Error).message, 'danger');
    }
  };

  const handleAddActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;

    const activityParticipants = currentGroup.members.length > 0 ? [currentGroup.members[0].id] : [];

    try {
      const newActivityId = uuidv4();
      const newActivity = {
        id: newActivityId,
        name: activityName,
        cost: parseFloat(activityCost),
        participants: activityParticipants,
        activity_type: activityType,
        date: new Date().toISOString(),
        status: 'planned',
      };
      setCurrentGroup(prevGroup =>
        prevGroup ? { ...prevGroup, activities: [...prevGroup.activities, newActivity] } : null
      );

      const response = await fetch(`${API_BASE_URL}/groups/${currentGroup.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activityName,
          cost: parseFloat(activityCost),
          activity_type: activityType,
          participants: activityParticipants,
        }),
      });
      const result: ApiResponse<Activity> = await response.json();
      if (result.status === 'success') {
        showAlert('Activity added successfully!', 'success');
        refreshCurrentGroupDetails();
        setActivityName('');
        setActivityCost('');
      } else {
        showAlert(result.message || 'Failed to add activity', 'danger');
        setCurrentGroup(prevGroup =>
          prevGroup ? { ...prevGroup, activities: prevGroup.activities.filter(act => act.id !== newActivityId) } : null
        );
      }
    } catch (error) {
      showAlert('Error adding activity: ' + (error as Error).message, 'danger');
    }
  };

  // Animation Variants
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.1 } },
  };

  // Helper: download a plain-text receipt for a group
  const handleDownloadReceipt = (group: Group) => {
    const totalExpenses = group.expenses.reduce((sum, e) => sum + e.amount, 0);
    const perMember = group.members.length ? totalExpenses / group.members.length : 0;
    let receipt = `DevYatra Group Expense Receipt\nGenerated: ${new Date().toLocaleString()}\n`;
    receipt += `Group: ${group.name}\nBudget: ₹${group.total_budget.toFixed(2)} | Remaining: ₹${group.remaining_budget.toFixed(2)}\n`;
    receipt += `Total Expenses: ₹${totalExpenses.toFixed(2)} | Per Member Share: ₹${perMember.toFixed(2)}\nMembers: ${group.members.map(m=>m.name).join(', ')}\n\nExpenses:\n`;
    group.expenses.forEach(exp => {
      const payer = group.members.find(m => m.id === exp.paid_by)?.name || exp.paid_by;
      receipt += `- ${exp.description}: ₹${exp.amount.toFixed(2)} (Paid by: ${payer})\n`;
    });
    const blob = new Blob([receipt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${group.name.replace(/\s+/g,'_')}_receipt.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert('Receipt downloaded.', 'success');
  };

  // Helper: compute settlement suggestions using simple netting algorithm
  const handleSettleUp = (group: Group) => {
    if (!group.expenses.length) {
      showAlert('No expenses to settle.', 'danger');
      return;
    }
    const balances: Record<string, number> = {};
    group.members.forEach(m => (balances[m.id] = 0));
    const total = group.expenses.reduce((s, e) => s + e.amount, 0);
    const fairShare = group.members.length ? total / group.members.length : 0;
    group.expenses.forEach(e => { if (balances[e.paid_by] !== undefined) balances[e.paid_by] += e.amount; });
    Object.keys(balances).forEach(id => { balances[id] -= fairShare; });
    const creditors: { id: string; amount: number }[] = []; const debtors: { id: string; amount: number }[] = [];
    Object.entries(balances).forEach(([id, amt]) => { if (amt > 0.01) creditors.push({id, amount: amt}); else if (amt < -0.01) debtors.push({id, amount: -amt}); });
    creditors.sort((a,b)=>b.amount-a.amount); debtors.sort((a,b)=>b.amount-a.amount);
    const settlements: string[] = []; let ci=0, di=0;
    while(ci<creditors.length && di<debtors.length){
      const c=creditors[ci]; const d=debtors[di]; const pay=Math.min(c.amount,d.amount);
      const payerName = group.members.find(m=>m.id===d.id)?.name || d.id;
      const receiverName = group.members.find(m=>m.id===c.id)?.name || c.id;
      settlements.push(`${payerName} -> ${receiverName}: ₹${pay.toFixed(2)}`);
      c.amount -= pay; d.amount -= pay; if(c.amount < 0.01) ci++; if(d.amount < 0.01) di++;
    }
    if (!settlements.length) { showAlert('Everyone is already settled.', 'success'); return; }
    // Use window.alert explicitly to avoid collision with alert state variable name
    if (typeof window !== 'undefined' && window.alert) {
      window.alert('Suggested Settlements:\n' + settlements.join('\n'));
    }
    // Also show a brief success banner
    showAlert('Settlement suggestions generated.', 'success');
    console.info('Settlement suggestions for group %s:', group.name, settlements);
  };



  return (
    <motion.div
      className="w-full max-w-5xl mx-auto mt-6 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <AnimatePresence>
        {alert && (
          <motion.div
            key="alert"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "fixed top-4 left-1/2 transform -translate-x-1/2 z-50 p-3 rounded-md shadow-lg",
              "flex items-center gap-2",
              alert.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            )}
            role="alert"
          >
            {alert.message}
            <button
              type="button"
              className="ml-auto text-xs font-semibold"
              onClick={() => setAlert(null)}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

  <Card className="shadow-lg w-full mb-8">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-blue-600">Create New Group</CardTitle>
          <CardDescription>
            Set up a new group to start managing shared expenses and activities.
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full">
          <form onSubmit={handleCreateGroup} className="space-y-4 w-full">
            <div>
              <Label htmlFor="group-name" className="block text-sm font-medium text-gray-700">Group Name</Label>
              <Input
                type="text"
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                placeholder="Enter group name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="group-budget" className="block text-sm font-medium text-gray-700">Total Budget</Label>
              <Input
                type="number"
                id="group-budget"
                value={groupBudget}
                onChange={(e) => setGroupBudget(e.target.value)}
                required
                placeholder="Enter total budget"
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white">
              Create Group
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 w-full">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Existing Groups</h2>
        <ScrollArea className="h-96 w-full rounded-md border">
          <div className="p-4">
            {groups.length === 0 ? (
              <p className="text-gray-500">No groups created yet.</p>
            ) : (
              <div className="space-y-3">
                {groups.map(group => {
                  // Calculate total expenses and per-member share
                  const totalExpenses = group.expenses.reduce((sum, exp) => sum + exp.amount, 0);
                  const memberCount = group.members.length || 1;
                  const perMemberShare = memberCount > 0 ? totalExpenses / memberCount : 0;
                  const budgetUsedPercent = group.total_budget > 0 ? (totalExpenses / group.total_budget) * 100 : 0;
                  return (
                    <motion.div
                      key={group.id}
                      className="p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col md:flex-row items-center justify-between w-full"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 120 }}
                    >
                      <div className="flex-1 w-full">
                        <h3 className="text-lg font-semibold text-blue-700">{group.name}</h3>
                        <p className="text-sm text-gray-500">
                          Budget: ₹{group.total_budget.toFixed(2)} | Remaining: ₹{group.remaining_budget.toFixed(2)}
                        </p>
                        <div className="mt-1 text-xs text-gray-600">
                          Total Expenses: ₹{totalExpenses.toFixed(2)} | Per Member: ₹{perMemberShare.toFixed(2)}
                        </div>
                        {/* Progress Bar for budget usage */}
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${Math.min(budgetUsedPercent, 100)}%` }}
                          ></div>
                        </div>
                        {/* Notes field placeholder */}
                        <div className="mt-2">
                          <span className="font-semibold text-xs">Notes:</span> <span className="text-xs text-gray-500">(Add notes feature...)</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 md:mt-0 md:ml-4">
                        <Button
                          variant="outline"
                          onClick={() => openGroupDetailsModal(group.id)}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50/50"
                        >
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          className="text-green-600 border-green-400 hover:bg-green-50/50"
                          onClick={() => handleDownloadReceipt(group)}
                        >
                          Download Receipt
                        </Button>
                        <Button
                          variant="outline"
                          className="text-purple-600 border-purple-400 hover:bg-purple-50/50"
                          onClick={() => handleSettleUp(group)}
                        >
                          Settle Up
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
        {/* Sorting/filtering options placeholder */}
        <div className="mt-4 flex gap-4 items-center">
          <span className="text-xs text-gray-500">(Sorting/filtering options coming soon...)</span>
        </div>
      </div>

      {/* Group Details Modal */}
      <AnimatePresence>
        {isModalOpen && currentGroup && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Card className="w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">Group Details: {currentGroup.name}</CardTitle>
                <CardDescription>
                  Manage members, expenses, and activities for this group.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="members" className="w-full" onValueChange={(value) => setActiveTab(value as 'members' | 'expenses' | 'activities')}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="expenses">Expenses</TabsTrigger>
                    <TabsTrigger value="activities">Activities</TabsTrigger>
                  </TabsList>
                  <TabsContent value="members">
                    <div className="p-4">
                      <h4 className="text-lg font-semibold mb-4">Members</h4>
                      <ScrollArea className="h-48 w-full rounded-md border mb-4">
                        <div className="p-4 space-y-2">
                          {currentGroup.members.length === 0 ? (
                            <p className="text-gray-500">No members yet.</p>
                          ) : (
                            currentGroup.members.map(member => (
                              <div
                                key={member.id}
                                className="p-2 bg-gray-50 rounded-md flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-medium">{member.name}</span>
                                </div>
                                <div className="text-sm text-gray-500">
                                  Budget: ₹{member.personal_budget.toFixed(2)} | Remaining: ₹{member.remaining_budget.toFixed(2)}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                      <h5 className="text-md font-semibold mb-2">Add New Member</h5>
                      <form onSubmit={handleAddMember} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="member-name" className="block text-sm font-medium text-gray-700">Name</Label>
                            <Input
                              type="text"
                              id="member-name"
                              placeholder="Member Name"
                              value={memberName}
                              onChange={e => setMemberName(e.target.value)}
                              required
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="member-budget" className="block text-sm font-medium text-gray-700">Personal Budget</Label>
                            <Input
                              type="number"
                              id="member-budget"
                              placeholder="Personal Budget"
                              value={memberBudget}
                              onChange={e => setMemberBudget(e.target.value)}
                              required
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <Button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white">
                          Add Member
                        </Button>
                      </form>
                    </div>
                  </TabsContent>

                  <TabsContent value="expenses">
                    <div className="p-4">
                      <h4 className="text-lg font-semibold mb-4">Expenses</h4>
                      <ScrollArea className="h-48 w-full rounded-md border mb-4">
                        <div className="p-4 space-y-4">
                          {currentGroup.expenses.length === 0 ? (
                            <p className="text-gray-500">No expenses recorded yet.</p>
                          ) : (
                            currentGroup.expenses.map(expense => (
                              <div key={expense.id} className="p-4 bg-gray-50 rounded-md">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium">{expense.description}</span>
                                  <span className="text-gray-700">
                                    ₹{expense.amount.toFixed(2)} (Paid by:{' '}
                                    {expense.paid_by === currentGroup.leader_id
                                      ? 'Leader'
                                      : currentGroup.members.find(m => m.id === expense.paid_by)?.name || expense.paid_by}
                                    )
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500 mb-2">
                                  Status: {expense.status} | Date:{' '}
                                  {new Date(expense.date).toLocaleDateString()}
                                </div>
                                <div>
                                  <span className="font-semibold">Splits:</span>
                                  <ul className="list-disc list-inside">
                                    {Object.entries(expense.splits).map(([memberId, share]) => (
                                      <li key={memberId} className="text-sm">
                                        {currentGroup.members.find(m => m.id === memberId)?.name || memberId}: ₹{share.toFixed(2)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                      <h5 className="text-md font-semibold mb-2">Add New Expense</h5>
                      <form onSubmit={handleAddExpense} className="space-y-4">
                        <div>
                          <Label htmlFor="expense-description" className="block text-sm font-medium text-gray-700">Description</Label>
                          <Input
                            type="text"
                            id="expense-description"
                            placeholder="Description"
                            value={expenseDescription}
                            onChange={e => setExpenseDescription(e.target.value)}
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="expense-amount" className="block text-sm font-medium text-gray-700">Amount</Label>
                          <Input
                            type="number"
                            id="expense-amount"
                            placeholder="Amount"
                            value={expenseAmount}
                            onChange={e => setExpenseAmount(e.target.value)}
                            required
                            step="0.01"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="expense-split-type" className="block text-sm font-medium text-gray-700">Split Type</Label>
                          <Select
                            value={expenseSplitType}
                            onValueChange={value => setExpenseSplitType(value)}
                          >
                            <SelectTrigger className="mt-1 w-full">
                              <SelectValue placeholder="Select a split type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equal">Equal</SelectItem>
                              <SelectItem value="custom" disabled>
                                Custom (UI not implemented)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white">
                          Add Expense
                        </Button>
                      </form>
                    </div>
                  </TabsContent>

                  <TabsContent value="activities">
                    <div className="p-4">
                      <h4 className="text-lg font-semibold mb-4">Activities</h4>
                      <ScrollArea className="h-48 w-full rounded-md border mb-4">
                        <div className="p-4 space-y-4">
                          {currentGroup.activities.length === 0 ? (
                            <p className="text-gray-500">No activities planned yet.</p>
                          ) : (
                            currentGroup.activities.map(activity => (
                              <div key={activity.id} className="p-4 bg-gray-50 rounded-md">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium">
                                    {activity.name} (Cost: ₹{activity.cost.toFixed(2)})
                                  </span>
                                  <span className="text-gray-500">
                                    {activity.activity_type} | Status: {activity.status}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <span className="font-semibold">Participants:</span>{' '}
                                  {activity.participants
                                    .map(pId => currentGroup.members.find(m => m.id === pId)?.name || pId)
                                    .join(', ') || 'None'}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                      <h5 className="text-md font-semibold mb-2">Add New Activity</h5>
                      <form onSubmit={handleAddActivity} className="space-y-4">
                        <div>
                          <Label htmlFor="activity-name" className="block text-sm font-medium text-gray-700">Activity Name</Label>
                          <Input
                            type="text"
                            id="activity-name"
                            placeholder="Activity Name"
                            value={activityName}
                            onChange={e => setActivityName(e.target.value)}
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="activity-cost" className="block text-sm font-medium text-gray-700">Estimated Cost</Label>
                          <Input
                            type="number"
                            id="activity-cost"
                            placeholder="Estimated Cost"
                            value={activityCost}
                            onChange={e => setActivityCost(e.target.value)}
                            required
                            step="0.01"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="activity-type" className="block text-sm font-medium text-gray-700">Activity Type</Label>
                          <Select
                            value={activityType}
                            onValueChange={value => setActivityType(value)}
                          >
                            <SelectTrigger className="mt-1 w-full">
                              <SelectValue placeholder="Select activity type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Dining">Dining</SelectItem>
                              <SelectItem value="Entertainment">Entertainment</SelectItem>
                              <SelectItem value="Travel">Travel</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white">
                          Add Activity
                        </Button>
                      </form>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              <CardFooter className="justify-end">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Close
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}