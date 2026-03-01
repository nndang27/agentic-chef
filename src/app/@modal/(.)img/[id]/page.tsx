import { getImages } from "~/server/db/queries";
import { Modal } from "./modal";
import FullPageImageView from "~/components/full-image-page";

export default async function PhotoModal(
  {
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const photoId = (await params).id;
  
    const isAdNumber = Number(photoId);
    if(Number.isNaN(isAdNumber)) throw new Error("Invalid photo id");
    const image = await getImages(isAdNumber);

  return <Modal>
    <FullPageImageView id={isAdNumber}/>
  </Modal>;
}
