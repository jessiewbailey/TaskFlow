from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional, Dict, Any, List
import pandas as pd
import json
import io
from datetime import datetime
from app.models.database import get_db
from app.models.schemas import Request, User, AIOutput, RequestStatus, Workflow
from app.models.pydantic_models import RequestResponse
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/export", tags=["export"])

@router.get("/stats")
async def get_export_stats(db: AsyncSession = Depends(get_db)):
    """Get statistics about exportable data"""
    
    try:
        # Get total tasks count
        total_result = await db.execute(select(func.count(Request.id)))
        total_tasks = total_result.scalar() or 0
        
        # Get completed tasks count (tasks with AI outputs)
        completed_result = await db.execute(
            select(func.count(Request.id.distinct()))
            .select_from(Request)
            .join(AIOutput, Request.id == AIOutput.request_id)
        )
        completed_tasks = completed_result.scalar() or 0
        
        # Calculate pending tasks
        pending_tasks = total_tasks - completed_tasks
        
        # Get workflows used
        workflows_result = await db.execute(
            select(Workflow.name)
            .select_from(Request)
            .join(Workflow, Request.workflow_id == Workflow.id)
            .distinct()
        )
        workflows_used = [name for name in workflows_result.scalars().all() if name]
        
        return {
            "totalTasks": total_tasks,
            "completedTasks": completed_tasks, 
            "pendingTasks": pending_tasks,
            "workflowsUsed": workflows_used
        }
        
    except Exception as e:
        logger.error("Error fetching export stats", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch export statistics")

@router.get("/excel")
async def export_to_excel(
    type: str = Query("completed", description="Export type: 'all' or 'completed'"),
    db: AsyncSession = Depends(get_db)
):
    """Export tasks and AI analysis data to Excel format"""
    
    try:
        # Build query
        query = select(Request).options(
            selectinload(Request.assigned_analyst),
            selectinload(Request.ai_outputs)
        )
        
        # Apply filter based on type
        if type == "completed":
            # Only include requests that have AI outputs
            query = query.join(AIOutput, Request.id == AIOutput.request_id)
        
        query = query.order_by(Request.created_at.desc())
        
        # Execute query
        result = await db.execute(query)
        requests = result.unique().scalars().all()
        
        if not requests:
            raise HTTPException(status_code=404, detail="No data found for export")
        
        # Prepare data for Excel
        export_data = []
        
        for req in requests:
            # Get latest AI output
            latest_ai_output = None
            if req.ai_outputs:
                latest_ai_output = max(req.ai_outputs, key=lambda x: x.version)
            
            # Base row data
            row_data = {
                "Task ID": req.id,
                "Task Text": req.text,
                "Submitter": req.requester or "",
                "Date Submitted": req.date_received.strftime("%Y-%m-%d") if req.date_received else "",
                "Status": req.status.value if req.status else "",
                "Assigned Analyst": req.assigned_analyst.name if req.assigned_analyst else "",
                "Due Date": req.due_date.strftime("%Y-%m-%d") if req.due_date else "",
                "Created At": req.created_at.strftime("%Y-%m-%d %H:%M:%S") if req.created_at else "",
                "Updated At": req.updated_at.strftime("%Y-%m-%d %H:%M:%S") if req.updated_at else "",
            }
            
            # Add AI output data if available
            if latest_ai_output:
                row_data.update({
                    "AI Version": latest_ai_output.version,
                    "Model Used": latest_ai_output.model_name or "",
                    "Tokens Used": latest_ai_output.tokens_used or 0,
                    "Processing Duration (ms)": latest_ai_output.duration_ms or 0,
                    "Processing Date": latest_ai_output.created_at.strftime("%Y-%m-%d %H:%M:%S") if latest_ai_output.created_at else "",
                    "Custom Instructions": latest_ai_output.custom_instructions or "",
                    "Sensitivity Score": float(latest_ai_output.sensitivity_score) if latest_ai_output.sensitivity_score else 0.0,
                })
                
                # Parse and add dynamic AI analysis fields
                if latest_ai_output.summary:
                    try:
                        summary_data = json.loads(latest_ai_output.summary)
                        # Flatten the nested JSON structure for Excel columns
                        flattened_data = _flatten_dict(summary_data, prefix="AI_")
                        row_data.update(flattened_data)
                    except (json.JSONDecodeError, TypeError):
                        # If it's not JSON, treat as plain text
                        row_data["AI_Summary"] = latest_ai_output.summary
                
                # Add redactions data
                if latest_ai_output.redactions_json:
                    try:
                        if isinstance(latest_ai_output.redactions_json, list):
                            redactions_count = len(latest_ai_output.redactions_json)
                            row_data["Redactions_Count"] = redactions_count
                            
                            # Add details about redactions
                            for i, redaction in enumerate(latest_ai_output.redactions_json[:5]):  # Limit to first 5
                                if isinstance(redaction, dict):
                                    row_data[f"Redaction_{i+1}_Reason"] = redaction.get("reason", "")
                                    row_data[f"Redaction_{i+1}_Text"] = redaction.get("text_span", "")
                    except Exception:
                        row_data["Redactions_Count"] = 0
            else:
                # No AI output available
                row_data.update({
                    "AI Version": "",
                    "Model Used": "",
                    "Tokens Used": 0,
                    "Processing Duration (ms)": 0,
                    "Processing Date": "",
                    "Custom Instructions": "",
                    "Sensitivity Score": 0.0,
                    "AI_Summary": "No AI analysis available"
                })
            
            export_data.append(row_data)
        
        # Create DataFrame
        df = pd.DataFrame(export_data)
        
        # Create Excel file in memory
        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Tasks and AI Analysis', index=False)
            
            # Get the workbook and worksheet
            workbook = writer.book
            worksheet = writer.sheets['Tasks and AI Analysis']
            
            # Auto-adjust column widths
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)  # Cap at 50 characters
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        excel_buffer.seek(0)
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"taskflow_export_{type}_{timestamp}.xlsx"
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(excel_buffer.read()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error("Error exporting to Excel", error=str(e))
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

def _flatten_dict(data: Dict[str, Any], prefix: str = "", separator: str = "_") -> Dict[str, Any]:
    """
    Flatten a nested dictionary for Excel export
    """
    flattened = {}
    
    for key, value in data.items():
        new_key = f"{prefix}{key}" if prefix else key
        
        if isinstance(value, dict):
            # Recursively flatten nested dictionaries
            flattened.update(_flatten_dict(value, f"{new_key}{separator}", separator))
        elif isinstance(value, list):
            # Handle lists
            if value and isinstance(value[0], dict):
                # List of dictionaries - flatten each with index
                for i, item in enumerate(value[:10]):  # Limit to first 10 items
                    if isinstance(item, dict):
                        flattened.update(_flatten_dict(item, f"{new_key}_{i+1}{separator}", separator))
            else:
                # Simple list - join as string
                flattened[new_key] = "; ".join(str(item) for item in value)
        else:
            # Simple value
            flattened[new_key] = value
    
    return flattened