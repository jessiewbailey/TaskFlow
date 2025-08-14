# GPT-OSS Model Reasoning Guide

## Overview
The `gpt-oss:20b` model supports configurable chain-of-thought reasoning levels that can significantly improve output quality for complex tasks.

## Reasoning Levels

### LOW
- **Use for**: Simple, straightforward tasks
- **Response time**: Fast
- **Quality**: Basic analysis
- **Example tasks**: Simple text extraction, basic formatting

### MEDIUM (Default)
- **Use for**: Standard analysis tasks
- **Response time**: Moderate
- **Quality**: Good balance of speed and accuracy
- **Example tasks**: Document summarization, standard analysis

### HIGH
- **Use for**: Complex analytical tasks
- **Response time**: Slower (more thinking)
- **Quality**: Thorough, step-by-step analysis
- **Example tasks**: Root cause analysis, complex problem solving, detailed recommendations

## Configuration Methods

### 1. Via Workflow Block Model Parameters
In the workflow editor, add to the block's `model_parameters`:

```json
{
  "reasoning_level": "HIGH",
  "temperature": 0.3,
  "num_predict": 1500
}
```

### 2. Automatic Detection
The system automatically selects reasoning level based on block names:
- Blocks with "analysis" or "complex" → HIGH
- Blocks with "simple" or "quick" → LOW
- All others → MEDIUM

### 3. Via System Prompt
You can also control reasoning through the system prompt:

```
REASONING LEVEL: HIGH
Think through this problem step-by-step before responding.
```

## Performance Considerations

| Reasoning Level | Relative Speed | Token Usage | Best For |
|----------------|---------------|-------------|----------|
| LOW | 1x (fastest) | Minimal | Quick tasks, simple extraction |
| MEDIUM | 2-3x | Moderate | Most general tasks |
| HIGH | 3-5x | Higher | Complex analysis, critical decisions |

## Testing Reasoning Levels

Run the test script to verify reasoning is working:

```bash
python /home/jessiewbailey/TaskFlow/test-reasoning-levels.py
```

Or from within Kubernetes:

```bash
kubectl exec -n taskflow deployment/ai-worker -- python /app/test-reasoning-levels.py
```

## Example Workflow Block Configuration

For a complex analysis block:

```json
{
  "name": "Root Cause Analysis",
  "model": "gpt-oss:20b",
  "model_parameters": {
    "reasoning_level": "HIGH",
    "temperature": 0.2,
    "num_predict": 2000
  },
  "prompt": "Analyze the issue and identify root causes...",
  "system_prompt": "You are an expert systems analyst."
}
```

## Troubleshooting

### Issue: Responses too quick, seem superficial
- **Solution**: Increase reasoning level to MEDIUM or HIGH
- **Check**: Verify `reasoning_level` in model_parameters

### Issue: Responses timing out
- **Solution**: Reduce reasoning level or increase timeout
- **Check**: Consider using MEDIUM instead of HIGH

### Issue: JSON formatting issues with reasoning
- **Solution**: The system automatically handles this for gpt-oss models
- **Check**: Ensure you're using the latest workflow_processor.py

## Technical Details

### How It Works
1. **Detection**: System identifies `gpt-oss` models as Harmony format
2. **Configuration**: Reasoning level set via parameters or defaults
3. **Prompt Enhancement**: System prompt includes reasoning instructions
4. **Format Handling**: JSON enforced via prompts (not API flags)
5. **Internal Processing**: Model performs chain-of-thought internally
6. **Clean Output**: Only final JSON returned (reasoning hidden)

### What Happens Internally
With HIGH reasoning, the model:
1. Analyzes the problem systematically
2. Considers multiple angles and possibilities
3. Weighs different solutions
4. Formulates a comprehensive response
5. Outputs only the final JSON (reasoning is internal)

This internal reasoning improves accuracy and completeness without cluttering the output.