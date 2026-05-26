import Link from "next/link";
import { Container } from "./container";

export const Header = () => {
  return (
    <>
      <div className="sticky top-0 z-20 bg-black text-white">
        <Container className="flex min-h-[--header-row-height] items-center justify-center">
            <div className="flex items-center">
              
                <img
                  src="/img/all/logo-home.png"
                  alt="Logo"
                  className="h-8 w-auto"
                />
              
            </div>
        </Container>
      </div>
    </>
  );
};
