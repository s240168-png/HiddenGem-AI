$body = @{
  "time_available_hours" = 5
  "group_size" = 2
  "budget_limit" = 1500
  "weather_condition" = "clear"
  "user_vibes" = @("Hidden Food", "Culture & Heritage", "Photography")
  "start_time" = "09:00 AM"
  "experiences" = @(
    @{
      "id" = 1
      "name" = "Test Food"
      "cost" = 300
      "duration_hours" = 1.5
      "latitude" = 16.99
      "longitude" = 73.31
      "vibes" = @("Hidden Food")
      "description" = "Delicious hidden gems."
    }
  )
} | ConvertTo-Json

Invoke-WebRequest -Method POST -Uri "http://localhost:5000/predict" -Headers @{"Content-Type"="application/json"} -Body $body | Select-Object -ExpandProperty Content

