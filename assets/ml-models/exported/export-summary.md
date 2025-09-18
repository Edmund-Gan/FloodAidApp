# FloodAid ML Model Export Summary

**Export Date**: 2025-09-19T00:35:10.771709

**Models Exported**: 5

**States Covered**: 11

## Model Performance Comparison

| Model | F1-Score | Precision | Recall | Accuracy | ROC-AUC |
|-------|----------|-----------|--------|----------|---------|
| SELANGOR | 0.8387 | 1.0000 | 0.7222 | 0.9533 | 0.9888 |
| KEDAH | 0.9000 | 1.0000 | 0.8182 | 0.9626 | 0.9396 |
| SABAH | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| EAST_COAST | 0.9048 | 1.0000 | 0.8261 | 0.9742 | 0.9713 |
| WEST_COAST | 0.8103 | 0.8868 | 0.7460 | 0.9469 | 0.9393 |

## State to Model Mapping

- **JOHOR** → WEST_COAST
- **KEDAH** → KEDAH
- **MELAKA** → WEST_COAST
- **NEGERI SEMBILAN** → WEST_COAST
- **PAHANG** → EAST_COAST
- **PERLIS** → WEST_COAST
- **PULAU PINANG** → WEST_COAST
- **SABAH** → SABAH
- **SELANGOR** → SELANGOR
- **TERENGGANU** → EAST_COAST
- **WILAYAH PERSEKUTUAN** → WEST_COAST

## Integration Notes

- All models use 31 standardized features
- XGBoost models exported with full tree structures
- Feature scaling parameters included for each model
- Real performance metrics replace generic 80.95% claims
