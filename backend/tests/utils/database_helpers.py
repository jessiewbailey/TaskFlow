"""
Database test utilities for TaskFlow integration tests

This module provides helper functions for setting up test data and 
handling SQLite compatibility issues in the test environment.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import (EmbeddingStatus, JobStatus, JobType,
                                ProcessingJob, Request, RequestStatus, User,
                                UserRole, Workflow, WorkflowBlock,
                                WorkflowEmbeddingConfig,
                                WorkflowSimilarityConfig, WorkflowStatus)


class DatabaseTestHelper:
    """Helper class for database operations in tests"""

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self._counters = {"user": 1, "workflow": 1, "request": 1, "job": 1}

    def _get_next_id(self, entity_type: str) -> int:
        """Get next available ID for entity type"""
        current = self._counters[entity_type]
        self._counters[entity_type] += 1
        return current

    async def create_test_user(
        self,
        name: str = "Test User",
        email: Optional[str] = None,
        role: UserRole = UserRole.ANALYST,
    ) -> User:
        """Create a test user with unique ID"""
        user_id = self._get_next_id("user")
        if email is None:
            email = f"test{user_id}@example.com"

        user = User(
            id=user_id,
            name=name,
            email=email,
            role=role,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def create_test_workflow(
        self,
        name: Optional[str] = None,
        description: str = "Test workflow",
        created_by: int = 1,
        status: WorkflowStatus = WorkflowStatus.ACTIVE,
        is_default: bool = False,
    ) -> Workflow:
        """Create a test workflow with unique ID"""
        workflow_id = self._get_next_id("workflow")
        if name is None:
            name = f"Test Workflow {workflow_id}"

        workflow = Workflow(
            id=workflow_id,
            name=name,
            description=description,
            status=status,
            is_default=is_default,
            created_by=created_by,
        )
        self.db.add(workflow)
        await self.db.flush()
        return workflow

    async def create_test_request(
        self,
        text: str = "Test request text",
        requester: str = "test@example.com",
        workflow_id: Optional[int] = None,
        status: RequestStatus = RequestStatus.NEW,
        embedding_status: EmbeddingStatus = EmbeddingStatus.PENDING,
    ) -> Request:
        """Create a test request with unique ID"""
        request_id = self._get_next_id("request")

        request = Request(
            id=request_id,
            text=text,
            requester=requester,
            workflow_id=workflow_id,
            status=status,
            embedding_status=embedding_status,
        )
        self.db.add(request)
        await self.db.flush()
        return request

    async def create_test_job(
        self,
        request_id: int,
        job_type: JobType = JobType.WORKFLOW,
        workflow_id: Optional[int] = None,
        status: JobStatus = JobStatus.PENDING,
    ) -> ProcessingJob:
        """Create a test processing job with unique UUID"""
        job_id = uuid.uuid4()

        job = ProcessingJob(
            id=job_id,
            request_id=request_id,
            workflow_id=workflow_id,
            job_type=job_type,
            status=status,
        )
        self.db.add(job)
        await self.db.flush()
        return job

    async def create_workflow_with_blocks(
        self,
        workflow_name: str = "Test Workflow with Blocks",
        block_configs: Optional[List[Dict[str, Any]]] = None,
    ) -> Workflow:
        """Create a workflow with workflow blocks"""
        workflow = await self.create_test_workflow(name=workflow_name)

        if block_configs is None:
            block_configs = [
                {
                    "name": "Summarize",
                    "prompt": "Summarize the following text: {{REQUEST_TEXT}}",
                    "order": 1,
                }
            ]

        for config in block_configs:
            block = WorkflowBlock(
                workflow_id=workflow.id,
                name=config["name"],
                prompt=config["prompt"],
                order=config["order"],
            )
            self.db.add(block)

        await self.db.flush()
        return workflow

    async def setup_basic_test_data(self) -> Dict[str, Any]:
        """Set up basic test data for most tests"""
        # Create a test user
        user = await self.create_test_user()

        # Create a test workflow
        workflow = await self.create_test_workflow(created_by=user.id)

        # Create a test request
        request = await self.create_test_request(workflow_id=workflow.id)

        await self.db.commit()

        return {"user": user, "workflow": workflow, "request": request}


# Utility functions for UUID handling
def convert_str_to_uuid(job_id):
    """Convert string job ID to UUID for database queries"""
    return uuid.UUID(job_id) if isinstance(job_id, str) else job_id


def convert_str_list_to_uuid_list(job_ids):
    """Convert list of string job IDs to UUID list for database queries"""
    return [uuid.UUID(job_id) for job_id in job_ids]


# Timezone handling for SQLite compatibility
def make_timezone_aware(dt, tz=timezone.utc):
    """Make a datetime timezone-aware if it isn't already"""
    return dt.replace(tzinfo=tz) if dt.tzinfo is None else dt


def compare_datetimes_safely(dt1, dt2):
    """Safely compare datetimes handling timezone differences"""
    dt1_aware = make_timezone_aware(dt1)
    dt2_aware = make_timezone_aware(dt2)
    return dt1_aware, dt2_aware
