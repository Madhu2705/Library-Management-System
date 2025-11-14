import AlmirahModel from "../models/almirah-model.js";
import BookModel from "../models/book-model.js";
import CategoryModel from "../models/category-model.js";
import deleteFile from "../services/delete-file-service.js";
import {
  ErrorHandlerService,
  handleMultipartData,
  paginationService,
} from "../services/index.js";
import { bookValidationSchema } from "../services/validation-service.js";

class BookController {
  /* MULTI PART FORM DATA RECIEVE, NOT JSON DATA */
  async createBook(req, res, next) {
    /* err RECEIVE IF ERROR COME WHILE UPLADING DATA */
    handleMultipartData(req, res, async (err) => {
      if (err) {
        return next(
          ErrorHandlerService.badRequest(
            "Something went wrong while uploading book image"
          )
        );
      }
      const uploadedFile = req.files?.["image"]?.[0];
      const filePath = uploadedFile ? `uploads/${uploadedFile.filename}` : undefined;
      console.log("Uploaded file:", uploadedFile);
      console.log("File path to store:", filePath);
      /* REQUEST VALIDATION , IMAGE ALREADY UPLOADED */
      const { error } = bookValidationSchema.validate(req.body);
      if (error) {
        /* CHECK IF IMAGE UPLOADED THEN DELETED BECOZ VALIDATION FAILED */
        if (uploadedFile && uploadedFile.path) {
          try {
            deleteFile(uploadedFile.path);
          } catch (error) {
            return next(error);
          }
        }
        return next(error);
      }
      /* STORE INTO DB  AND ALSO CHANGED CATEGORY COUNT AND ALMIRAH COUNT */
      try {
        /* CHECK ISBN ALREADY EXIST ? ISBN SHOULD BE UNIQUE */
        const isExist = await BookModel.findOne({ ISBN: req.body.ISBN });
        if (isExist) {
          if (uploadedFile && uploadedFile.path) {
            deleteFile(uploadedFile.path);
          }
          return next(
            ErrorHandlerService.validationError("ISBN Already exist")
          );
        }

        const book = new BookModel({
          ...req.body,
          imagePath: filePath,
        });

        await book.save();
        return res.status(200).json({ book });
      } catch (error) {
        next(error);
      }
    });
  }

  async getBooks(req, res, next) {
    /* PAGINATION */
    const { page, limit, skip } = paginationService(req);
    /* FILTERING */
    const { qISBN = "", qTitle = "", qStatus, qCategory, qAlmirah } = req.query;
    console.log(qCategory);
    const regexQueryISBN = new RegExp(qISBN, "i");
    const regexQueryTitle = new RegExp(qTitle, "i");
    const filter = [
      { ISBN: { $regex: regexQueryISBN } },
      { title: { $regex: regexQueryTitle } },
      { isDeleted: false },
    ];
    if (qCategory) {
      filter.push({ category: qCategory });
    }
    if (qAlmirah) {
      filter.push({ almirah: qAlmirah });
    }
    if (qStatus) {
      filter.push({ status: qStatus });
    }

    try {
      const [books, totalRecords] = await Promise.all([
        BookModel.find({ $and: filter }, "-__v")
          .sort({ updatedAt: -1 })
          .populate("category", "-__v")
          .populate("almirah", "-__v")
          .skip(skip)
          .limit(limit)
          .exec(),
        BookModel.countDocuments({ $and: filter }).exec(),
      ]);
      const totalPages = Math.ceil(totalRecords / limit);
      return res
        .status(200)
        .json({ books, page, limit, totalRecords, totalPages });
    } catch (error) {
      next(error);
    }
  }

  async getBook(req, res, next) {
    const { _id } = req.params;
    try {
      const document = await BookModel.findById(_id, "-__v")
        .populate("category")
        .populate("almirah")
        .populate({
          path: "reviews.user",
          select: "name",
        });
      if (!document) {
        return next(ErrorHandlerService.notFound());
      }
      return res.status(200).json(document);
    } catch (error) {
      next(error);
    }
  }

  async updateBook(req, res, next) {
    handleMultipartData(req, res, async (err) => {
      if (err) {
        return next(err);
      }
      const uploadedFile = req.files?.["image"]?.[0];
      const filePath = uploadedFile ? `uploads/${uploadedFile.filename}` : undefined;
      const { _id } = req.params;
      const { error } = bookValidationSchema.validate(req.body);
      if (error) {
        /*CHECK IMAGE UPLOAD? DELETE UPLOADED IMAGE */
        try {
          if (filePath && uploadedFile) {
            deleteFile(uploadedFile.path);
          }
        } catch (error) {
          next(error);
        }
        return next(error);
      }
      /* UPDATE */
      try {
        const document = await BookModel.findByIdAndUpdate(_id, req.body);
        console.log(document);
        /* CHECK NEW IMAGE IS UPLOADED THEN REMOVE OLD AND ADD NEW ONE */
        if (filePath && uploadedFile) {
          const oldImage = document.imagePath;
          if (oldImage) {
            deleteFile(oldImage);
          }
          document.imagePath = filePath;
          await document.save();
        }
        return res.status(201).json({ msg: "Book updated successfully" });
      } catch (error) {
        next(error);
      }
    });
  }

  async deleteBook(req, res, next) {
    const { _id } = req.params;
    try {
      const document = await BookModel.findById(_id);
      if (!document) {
        return next(ErrorHandlerService.notFound("Book Not Found"));
      }
      document.isDeleted = true;
      await document.save();
      return res.status(204).json({ message: "Book Deleted Successfull" });
    } catch (error) {
      next(error);
    }
  }

}

export default new BookController();
