defmodule TeslaMateWeb.DriveView do
  use TeslaMateWeb, :view

  def render("index.json", %{drives: drives, pagination: pagination, cars: cars}) do
    %{
      drives: Enum.map(drives, &drive_json/1),
      cars: cars,
      pagination: %{
        page: pagination.page,
        perPage: pagination.per_page,
        total: pagination.total,
        totalPages: pagination.total_pages
      }
    }
  end

  def render("show.json", %{drive: drive}) do
    %{drive: drive_json(drive)}
  end

  def render("tags.json", %{tags: tags}) do
    %{tags: Enum.map(tags, & &1.name)}
  end

  def render("error.json", %{message: message}) do
    %{error: message}
  end

  defp drive_json(drive) do
    %{
      id: drive.id,
      car: car_name(drive.car),
      startDate: iso8601(drive.start_date),
      endDate: iso8601(drive.end_date),
      startAddress: address_name(drive.start_address),
      endAddress: address_name(drive.end_address),
      startLocation: location_json(drive.start_address),
      endLocation: location_json(drive.end_address),
      distanceKm: drive.distance || 0,
      notes: drive.notes || "",
      tags: drive |> tag_names() |> Enum.sort()
    }
  end

  defp iso8601(nil), do: nil
  defp iso8601(%DateTime{} = date_time), do: DateTime.to_iso8601(date_time)

  defp iso8601(%NaiveDateTime{} = date_time),
    do: date_time |> DateTime.from_naive!("Etc/UTC") |> DateTime.to_iso8601()

  defp address_name(nil), do: ""
  defp address_name(%{display_name: display_name}) when is_binary(display_name), do: display_name
  defp address_name(_address), do: ""

  defp location_json(%{latitude: latitude, longitude: longitude})
       when not is_nil(latitude) and not is_nil(longitude) do
    %{
      latitude: Decimal.to_float(latitude),
      longitude: Decimal.to_float(longitude)
    }
  end

  defp location_json(_address), do: nil

  defp car_name(nil), do: ""
  defp car_name(%{name: name}) when is_binary(name), do: name
  defp car_name(%{marketing_name: name}) when is_binary(name), do: name
  defp car_name(%{model: model}) when is_binary(model), do: model
  defp car_name(_car), do: ""

  defp tag_names(drive) do
    (drive.tags || [])
    |> Enum.map(& &1.name)
  end
end
