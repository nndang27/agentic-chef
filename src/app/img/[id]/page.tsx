import { getImages } from "~/server/db/queries";
import FullPageImageView from "~/components/full-image-page";

export default async function PhotoPage(
  {
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const photoId = (await params).id;
  
    const isAdNumber = Number(photoId);
    if(Number.isNaN(isAdNumber)) throw new Error("Invalid photo id");

  return <FullPageImageView id={isAdNumber}/>
}
