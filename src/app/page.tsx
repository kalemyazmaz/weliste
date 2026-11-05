import { redirect } from "next/navigation";

// Ana adres randevu ürününün sektör seçim sayfasına gider.
export default function Home() {
  redirect("/randevu");
}
