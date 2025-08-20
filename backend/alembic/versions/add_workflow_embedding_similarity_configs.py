"""Add workflow embedding and similarity configuration tables

Revision ID: add_workflow_configs_001
Revises:
Create Date: 2025-08-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_workflow_configs_001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create workflow_embedding_configs table
    op.create_table(
        'workflow_embedding_configs',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('workflow_id', sa.BigInteger(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('embedding_template', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('workflow_id')
    )

    # Create workflow_similarity_configs table
    op.create_table(
        'workflow_similarity_configs',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('workflow_id', sa.BigInteger(), nullable=False),
        sa.Column('fields', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.TIMESTAMP(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('workflow_id')
    )

    # Create indexes
    op.create_index('idx_workflow_embedding_configs_workflow_id', 'workflow_embedding_configs', ['workflow_id'])
    op.create_index('idx_workflow_similarity_configs_workflow_id', 'workflow_similarity_configs', ['workflow_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_workflow_similarity_configs_workflow_id', 'workflow_similarity_configs')
    op.drop_index('idx_workflow_embedding_configs_workflow_id', 'workflow_embedding_configs')

    # Drop tables
    op.drop_table('workflow_similarity_configs')
    op.drop_table('workflow_embedding_configs')