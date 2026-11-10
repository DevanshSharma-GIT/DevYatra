"""Group expense splitter routes (modular blueprint).
Provides in-memory group management required by /split frontend page.
If persistence is needed later, swap in DB layer keeping same response shapes.
"""
from flask import Blueprint, request, jsonify
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import uuid
from datetime import datetime

# Feature flag (can be toggled from app factory if desired)
ENABLE_GROUP_FEATURE = True

groups_bp = Blueprint('groups', __name__, url_prefix='/api') if ENABLE_GROUP_FEATURE else None

if ENABLE_GROUP_FEATURE:
    @dataclass
    class GroupMember:
        id: str
        name: str
        personal_budget: float
        remaining_budget: float
        preferences: Dict[str, bool] = field(default_factory=dict)
        activities: List[str] = field(default_factory=list)
        expenses: List[Dict] = field(default_factory=list)  # list of {expense_id, share, description}
        payments: Dict[str, bool] = field(default_factory=dict)

        def to_dict(self):
            return {
                'id': self.id,
                'name': self.name,
                'personal_budget': self.personal_budget,
                'remaining_budget': self.remaining_budget,
                'preferences': self.preferences,
                'activities': self.activities,
                'expenses': self.expenses,
                'payments': self.payments
            }

    @dataclass
    class GroupData:
        id: str
        name: str
        total_budget: float
        remaining_budget: float
        total_spent: float
        leader_id: str
        members: Dict[str, GroupMember] = field(default_factory=dict)
        expenses: List[Dict] = field(default_factory=list)
        activities: List[Dict] = field(default_factory=list)

        def to_dict(self):
            return {
                'id': self.id,
                'name': self.name,
                'total_budget': self.total_budget,
                'remaining_budget': self.remaining_budget,
                'total_spent': self.total_spent,
                'leader_id': self.leader_id,
                'members': [m.to_dict() for m in self.members.values()],
                'expenses': self.expenses,
                'activities': self.activities
            }

    class DevTracker:
        def __init__(self):
            self.groups: Dict[str, GroupData] = {}

        # --- Core operations ---
        def create_group(self, name: str, total_budget: float, leader_id: str) -> str:
            group_id = str(uuid.uuid4())
            group = GroupData(
                id=group_id,
                name=name,
                total_budget=total_budget,
                remaining_budget=total_budget,
                total_spent=0.0,
                leader_id=leader_id
            )
            self.groups[group_id] = group
            # Add leader placeholder member (so splits work immediately)
            leader_member_id = str(uuid.uuid4())
            group.members[leader_member_id] = GroupMember(
                id=leader_member_id,
                name='Leader',
                personal_budget=total_budget,
                remaining_budget=total_budget
            )
            return group_id

        def add_member(self, group_id: str, name: str, personal_budget: float) -> str:
            if group_id not in self.groups:
                raise ValueError('Group not found')
            member_id = str(uuid.uuid4())
            self.groups[group_id].members[member_id] = GroupMember(
                id=member_id,
                name=name,
                personal_budget=personal_budget,
                remaining_budget=personal_budget
            )
            return member_id

        def add_expense(self, group_id: str, amount: float, description: str, paid_by: str, split_type: str = 'equal', custom_splits: Dict[str, float] = None) -> str:
            if group_id not in self.groups:
                raise ValueError('Group not found')
            group = self.groups[group_id]
            expense_id = str(uuid.uuid4())
            expense = {
                'id': expense_id,
                'amount': amount,
                'description': description,
                'paid_by': paid_by,
                'splits': {},
                'date': datetime.now().isoformat(),
                'status': 'pending'
            }
            member_ids = list(group.members.keys())
            if not member_ids:
                raise ValueError('No members to split expense')
            if split_type == 'equal':
                share = round(amount / len(member_ids), 2)
                for mid in member_ids:
                    expense['splits'][mid] = share
            elif split_type == 'custom' and custom_splits:
                expense['splits'] = custom_splits
            else:
                raise ValueError('Invalid split_type or missing custom_splits')
            group.expenses.append(expense)
            return expense_id

        def add_activity(self, group_id: str, name: str, cost: float, participants: List[str], activity_type: str) -> str:
            if group_id not in self.groups:
                raise ValueError('Group not found')
            activity_id = str(uuid.uuid4())
            activity = {
                'id': activity_id,
                'name': name,
                'cost': cost,
                'participants': participants,
                'activity_type': activity_type,
                'date': datetime.now().isoformat(),
                'status': 'planned'
            }
            self.groups[group_id].activities.append(activity)
            return activity_id

    tracker = DevTracker()

    # --- Routes ---
    @groups_bp.route('/groups', methods=['OPTIONS'])
    def groups_preflight():
        return ('', 204)

    @groups_bp.route('/groups', methods=['POST'])
    def create_group():
        data = request.json or {}
        if 'name' not in data or 'total_budget' not in data:
            return jsonify({"status": "error", "message": "Missing name or total_budget"}), 400
        leader_id = data.get('leader_id', 'default_leader')
        try:
            group_id = tracker.create_group(data['name'], float(data['total_budget']), leader_id)
            return jsonify({"status": "success", "message": "Group created successfully", "data": tracker.groups[group_id].to_dict()}), 201
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    @groups_bp.route('/groups', methods=['GET'])
    def list_groups():
        return jsonify({"status": "success", "data": [g.to_dict() for g in tracker.groups.values()]})

    @groups_bp.route('/groups/<group_id>', methods=['GET'])
    @groups_bp.route('/groups/<group_id>/summary', methods=['GET'])
    def get_group(group_id):
        if group_id not in tracker.groups:
            return jsonify({"status": "error", "message": "Group not found"}), 404
        return jsonify({"status": "success", "data": tracker.groups[group_id].to_dict()})

    @groups_bp.route('/groups/<group_id>/members', methods=['POST'])
    def add_member(group_id):
        data = request.json or {}
        if 'name' not in data or 'personal_budget' not in data:
            return jsonify({"status": "error", "message": "Missing name or personal_budget"}), 400
        try:
            member_id = tracker.add_member(group_id, data['name'], float(data['personal_budget']))
            member = tracker.groups[group_id].members[member_id]
            return jsonify({"status": "success", "message": "Member added successfully", "data": member.to_dict()}), 201
        except ValueError as e:
            return jsonify({"status": "error", "message": str(e)}), 404
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    @groups_bp.route('/groups/<group_id>/expenses', methods=['POST'])
    def add_expense(group_id):
        data = request.json or {}
        required = ['amount', 'description', 'paid_by']
        if not all(k in data for k in required):
            return jsonify({"status": "error", "message": "Missing required fields for expense"}), 400
        try:
            expense_id = tracker.add_expense(
                group_id,
                float(data['amount']),
                data['description'],
                data['paid_by'],
                data.get('split_type', 'equal'),
                data.get('custom_splits')
            )
            expense = next((e for e in tracker.groups[group_id].expenses if e['id'] == expense_id), None)
            return jsonify({"status": "success", "message": "Expense added successfully", "data": expense}), 201
        except ValueError as e:
            return jsonify({"status": "error", "message": str(e)}), 400
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    @groups_bp.route('/groups/<group_id>/activities', methods=['POST'])
    def add_activity(group_id):
        data = request.json or {}
        required = ['name', 'cost', 'participants', 'activity_type']
        if not all(k in data for k in required):
            return jsonify({"status": "error", "message": "Missing required fields for activity"}), 400
        try:
            activity_id = tracker.add_activity(
                group_id,
                data['name'],
                float(data['cost']),
                data['participants'],
                data['activity_type']
            )
            activity = next((a for a in tracker.groups[group_id].activities if a['id'] == activity_id), None)
            return jsonify({"status": "success", "message": "Activity added successfully", "data": activity}), 201
        except ValueError as e:
            return jsonify({"status": "error", "message": str(e)}), 400
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
