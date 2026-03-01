import { getImages } from "~/server/db/queries";
export default async function FullPageImageView(
  props: {id:  number}) {
    const image = await getImages(props.id);

  return (
  <div className="flex h-full w-full min-w-0 ">
    <div className="flex flex-shrink items-center justify-center">
      <img src={image.url} className=" flex-shrink object-contain" />
    </div>

    <div className="flex w-48 flex-shrink-0 flex-col border-l gap-2" >
      <div className="border-b p-2 text-center text-lg">{image.name}</div>
    
    </div>
  </div>

  );
}
