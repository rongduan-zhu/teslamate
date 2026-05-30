defmodule TeslaMateWeb.DriveController do
  use TeslaMateWeb, :controller

  require Logger
  import Ecto.Query

  alias TeslaMate.Log
  alias TeslaMate.Log.{Drive, Position}
  alias TeslaMate.Repo

  action_fallback TeslaMateWeb.FallbackController

  def index(conn, _params) do
    render(conn, "index.json", drives: Log.list_completed_drives())
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

  defp send_gpx_file(conn, drive) do
    filename = "#{drive.start_date}.gpx"

    conn
    |> put_resp_content_type("application/xml")
    |> put_resp_header("content-disposition", ~s(attachment; filename="#{filename}"))
    |> render("gpx.xml", drive: drive)
  end
end
