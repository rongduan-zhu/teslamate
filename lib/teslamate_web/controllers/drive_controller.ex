defmodule TeslaMateWeb.DriveController do
  use TeslaMateWeb, :controller

  require Logger
  import Ecto.Query

  alias TeslaMate.Log
  alias TeslaMate.Log.{Drive, Position}
  alias TeslaMate.Repo

  action_fallback TeslaMateWeb.FallbackController

  @default_page 1
  @default_per_page 25
  @max_per_page 100

  def index(conn, params) do
    page =
      params
      |> Map.get("page")
      |> parse_positive_integer(@default_page)

    per_page =
      params
      |> Map.get("perPage", Map.get(params, "per_page"))
      |> parse_positive_integer(@default_per_page)
      |> min(@max_per_page)

    result =
      Log.list_completed_drives_page(
        page: page,
        per_page: per_page,
        car: Map.get(params, "car")
      )

    render(conn, "index.json",
      drives: result.entries,
      pagination: result,
      cars: Log.list_completed_drive_car_names()
    )
  end

  def tags(conn, _params) do
    render(conn, "tags.json", tags: Log.list_tags())
  end

  def update(conn, %{"id" => id} = params) do
    with %Drive{} = drive <- Log.get_drive(id),
         {:ok, drive} <- Log.update_drive_meta(drive, drive_meta_params(params)) do
      render(conn, "show.json", drive: drive)
    else
      nil ->
        conn
        |> put_status(:not_found)
        |> render("error.json", message: "Drive not found")

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> put_view(TeslaMateWeb.ChangesetView)
        |> render("error.json", changeset: changeset)
    end
  end

  def gpx(conn, %{"id" => id}) do
    drive =
      Drive
      |> Repo.get(id)
      |> Repo.preload(positions: from(p in Position, order_by: p.date))

    case drive do
      nil -> conn |> send_resp(404, "Drive not found")
      drive -> send_gpx_file(conn, drive)
    end
  end

  defp drive_meta_params(params) do
    params
    |> Map.take(["notes", "tags"])
    |> Enum.map(fn
      {"notes", notes} -> {:notes, notes}
      {"tags", tags} -> {:tags, tags}
    end)
    |> Map.new()
  end

  defp parse_positive_integer(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {integer, ""} when integer > 0 -> integer
      _ -> default
    end
  end

  defp parse_positive_integer(value, _default) when is_integer(value) and value > 0, do: value
  defp parse_positive_integer(_value, default), do: default

  defp send_gpx_file(conn, drive) do
    filename = "#{drive.start_date}.gpx"

    conn
    |> put_resp_content_type("application/xml")
    |> put_resp_header("content-disposition", ~s(attachment; filename="#{filename}"))
    |> render("gpx.xml", drive: drive)
  end
end
